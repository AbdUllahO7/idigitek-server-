import mongoose from "mongoose";
import { AppError } from "../middleware/errorHandler.middleware";
import UserModel from "../models/user.model";
import WebSiteModel from "../models/WebSite.model";
import WebSiteUserModel from "../models/webSiteUser.model";
import { WebSiteProps } from "../types/WebSite.type";
import cloudinaryService from "./cloudinary.service";
import { File } from 'multer';
import SubSectionModel from "../models/subSections.model";
import ContentElementModel from "../models/ContentElement.model";
import SectionItemModel from "../models/sectionItems.model";
import SectionModel from "../models/sections.model";
import ContentTranslationModel from "../models/ContentTranslation.model";

export class WebSiteService {
    /**
     * Create a new website and associate it with the creator user
     */
    async createWebSite(webSiteData: WebSiteProps, userId: string): Promise<WebSiteProps> {
        const session = await mongoose.startSession();
        session.startTransaction();
        
        try {
            // Check if user already has a website
            const existingWebsite = await WebSiteUserModel.findOne({ userId }).session(session);
            if (existingWebsite) {
                throw new AppError('User can only create one website', 400);
            }
            
            // Create the website with creator's userId
            const website = await WebSiteModel.create([{
                ...webSiteData
            }], { session });
            
            // Associate the user with the website as owner
            await WebSiteUserModel.create([{
                userId,
                webSiteId: website[0]._id,
                role: 'owner'
            }], { session });
            
            await session.commitTransaction();
            return website[0];
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }
    
    /**
     * Get all websites
     */
    async getAllWebSites(): Promise<WebSiteProps[]> {
        return WebSiteModel.find();
    }
    
    /**
     * Get a website by ID
     */
    async getWebSiteById(id: string): Promise<WebSiteProps | null> {
        return WebSiteModel.findById(id);
    }
    
    /**
     * Get all websites for a specific user
     */
    async getWebSitesByUserId(userId: string): Promise<WebSiteProps[]> {
        // Find all website-user relationships for this user
        const websiteUsers = await WebSiteUserModel.find({ userId });
        
        // Get the website IDs
        const websiteIds = websiteUsers.map(wu => wu.webSiteId);
        
        // Find all websites
        return WebSiteModel.find({
            _id: { $in: websiteIds }
        });
    }

    /**
     * Upload logo image for a website
     */
    async uploadWebSiteLogo(id: string, file: File): Promise<WebSiteProps> {
        try {
            // Validate ID
            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw AppError.validation('Invalid website ID format');
            }
        
            // Find the website
            const website = await WebSiteModel.findById(id);
            if (!website) {
                throw AppError.notFound(`Website with ID ${id} not found`);
            }
        
            // Check if the user has permission to update this website
            // Note: This check would need to be handled in the controller if we need the userId
            
            // Upload to Cloudinary
            const result = await cloudinaryService.uploadImage(file.path);
            
            // Update website with logo URL
            website.logo = result.secure_url;
            
            // Optional: store additional cloudinary data in metadata
            if (!website.metadata) website.metadata = {};
            website.metadata.cloudinaryId = result.public_id;
            website.metadata.width = result.width;
            website.metadata.height = result.height;
            
            // Save and return updated website
            return await website.save();
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw AppError.database('Failed to upload logo for website', error);
        }
    }
    
    /**
     * Update a website by ID
     */
    async updateWebSite(id: string, updateData: Partial<WebSiteProps>, userId: string): Promise<WebSiteProps | null> {
        // Verify the user has permission to update this website
        const websiteUser = await WebSiteUserModel.findOne({ 
            webSiteId: id, 
            userId,
            role: { $in: ['owner', 'editor'] }
        });
        
        if (!websiteUser) {
            throw new AppError('You do not have permission to update this website', 403);
        }
        
        return WebSiteModel.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );
    }
    
    /**
     * Delete a website by ID
     */
   
    /**
     * Delete a website by ID with complete cascade deletion
     * @param id The website ID
     * @param userId The user requesting the deletion
     * @param hardDelete Whether to permanently delete (default: true for complete removal)
     * @returns Promise with deletion results
     */
    async deleteWebSite(id: string, userId: string, hardDelete = true): Promise<{
        success: boolean;
        message: string;
        deletedCounts?: {
            websites: number;
            websiteUsers: number;
            sections: number;
            sectionItems: number;
            subsections: number;
            contentElements: number;
            contentTranslations: number;
            imagesDeleted: number;
        };
    }> {
       

        // Verify the user has permission to delete this website
        const websiteUser = await WebSiteUserModel.findOne({ 
            webSiteId: id, 
            userId,
            role: 'owner'
        });
        
        if (!websiteUser) {
            throw new AppError('You do not have permission to delete this website', 403);
        }

        const session = await mongoose.startSession();
        session.startTransaction();
        
        try {
            
            // Get the website with its logo
            const website = await WebSiteModel.findById(id).session(session);
            if (!website) {
                throw new AppError('Website not found', 404);
            }
            
            // Store images for later deletion
            const imagesToDelete: string[] = [];
            if (website.logo) {
                imagesToDelete.push(website.logo);
            }
            
            
            // STEP 1: Find all Sections belonging to this website
            const sections = await SectionModel.find({ WebSiteId: id }).session(session);
            const sectionIds = sections.map(section => section._id);
            
            // Collect section images
            sections.forEach(section => {
                if (section.image) {
                    imagesToDelete.push(section.image);
                }
            });
            
            // STEP 2: Find all SectionItems belonging to this website
            const sectionItems = await SectionItemModel.find({
                $or: [
                    { WebSiteId: id }, // Direct relationship
                    { section: { $in: sectionIds } } // Through sections
                ]
            }).session(session);
            const sectionItemIds = sectionItems.map(item => item._id);
            
            // Collect section item images
            sectionItems.forEach(item => {
                if (item.image) {
                    imagesToDelete.push(item.image);
                }
            });
            
            // STEP 3: Find all SubSections belonging to this website
            const subsections = await SubSectionModel.find({
                $or: [
                    { WebSiteId: id }, // Direct relationship
                    { section: { $in: sectionIds } }, // Through sections
                    { sectionItem: { $in: sectionItemIds } } // Through section items
                ]
            }).session(session);
            const subsectionIds = subsections.map(subsection => subsection._id);
            
            // STEP 4: Find all ContentElements for website, sections, section items, and subsections
            const contentElements = await ContentElementModel.find({
                $or: [
                    // Elements directly belonging to the website
                    { parent: id },
                    // Elements belonging to sections
                    { parent: { $in: sectionIds } },
                    // Elements belonging to section items
                    { parent: { $in: sectionItemIds } },
                    // Elements belonging to subsections
                    { parent: { $in: subsectionIds } },
                    // Legacy format - if you're using parentType/parentId
                    { parentType: 'website', parentId: id },
                    { parentType: 'section', parentId: { $in: sectionIds } },
                    { parentType: 'sectionItem', parentId: { $in: sectionItemIds } },
                    { parentType: 'subsection', parentId: { $in: subsectionIds } }
                ]
            }).session(session);
            const contentElementIds = contentElements.map(element => element._id);
            
            // Collect content element images
            contentElements.forEach(element => {
                if (element.imageUrl) {
                    imagesToDelete.push(element.imageUrl);
                }
            });
            
            // STEP 5: Delete all ContentTranslations for these elements
            const deletedTranslations = await ContentTranslationModel.deleteMany({
                $or: [
                    { contentElement: { $in: contentElementIds } },
                    { elementId: { $in: contentElementIds } } // Handle both field names
                ]
            }).session(session);
            
            // STEP 6: Delete all ContentElements
            const deletedElements = await ContentElementModel.deleteMany({
                $or: [
                    { parent: id },
                    { parent: { $in: sectionIds } },
                    { parent: { $in: sectionItemIds } },
                    { parent: { $in: subsectionIds } },
                    { parentType: 'website', parentId: id },
                    { parentType: 'section', parentId: { $in: sectionIds } },
                    { parentType: 'sectionItem', parentId: { $in: sectionItemIds } },
                    { parentType: 'subsection', parentId: { $in: subsectionIds } }
                ]
            }).session(session);
            
            // STEP 7: Delete all SubSections
            const deletedSubsections = await SubSectionModel.deleteMany({
                $or: [
                    { WebSiteId: id },
                    { section: { $in: sectionIds } },
                    { sectionItem: { $in: sectionItemIds } }
                ]
            }).session(session);
            
            // STEP 8: Delete all SectionItems
            const deletedSectionItems = await SectionItemModel.deleteMany({
                $or: [
                    { WebSiteId: id },
                    { section: { $in: sectionIds } }
                ]
            }).session(session);
            
            // STEP 9: Delete all Sections
            const deletedSections = await SectionModel.deleteMany({
                WebSiteId: id
            }).session(session);
            
            // STEP 10: Delete all WebSiteUser associations
            const deletedWebsiteUsers = await WebSiteUserModel.deleteMany({
                webSiteId: id
            }).session(session);
            
            // STEP 11: Finally, delete the website itself
            const deletedWebsite = await WebSiteModel.findByIdAndDelete(id).session(session);
            
            // Commit the transaction
            await session.commitTransaction();
            
            // STEP 12: Delete all images from Cloudinary (after transaction is committed)
            let imagesDeleted = 0;
            if (imagesToDelete.length > 0) {
                
                for (const imageUrl of imagesToDelete) {
                    try {
                        const publicId = cloudinaryService.getPublicIdFromUrl(imageUrl);
                        if (publicId) {
                            await cloudinaryService.deleteImage(publicId);
                            imagesDeleted++;
                        }
                    } catch (imageError) {
                        console.error(`Failed to delete image ${imageUrl}:`, imageError);
                        // Don't throw error for image deletion failures
                    }
                }
            }
            
            return { 
                success: true,
                message: 'Website and all related data deleted successfully',
                deletedCounts: {
                    websites: 1,
                    websiteUsers: deletedWebsiteUsers.deletedCount,
                    sections: deletedSections.deletedCount,
                    sectionItems: deletedSectionItems.deletedCount,
                    subsections: deletedSubsections.deletedCount,
                    contentElements: deletedElements.deletedCount,
                    contentTranslations: deletedTranslations.deletedCount,
                    imagesDeleted
                }
            };
            
        } catch (error) {
            await session.abortTransaction();
            console.error(`❌ Error deleting website ${id}:`, error);
            if (error instanceof AppError) throw error;
            throw new AppError('Failed to delete website', 500);
        } finally {
            session.endSession();
        }
    }


    
    /**
     * Add a user to a website
     */
    async addUserToWebSite(webSiteId: string, userIdToAdd: string, role: string, requestingUserId: string): Promise<any> {
        // Verify the requesting user has permission to add users to this website
        const requestingWebsiteUser = await WebSiteUserModel.findOne({ 
            webSiteId, 
            userId: requestingUserId,
            role: { $in: ['owner', 'superAdmin'] }  // Modified to check for either role
        });

        
        if (!requestingWebsiteUser) {
            throw new AppError('You do not have permission to add users to this website', 403);
        }
        
        // Verify the user to be added exists
        const userToAdd = await UserModel.findById(userIdToAdd);
        if (!userToAdd) {
            throw new AppError('User not found', 404);
        }
        
        // Check if the user is already associated with the website
        const existingAssociation = await WebSiteUserModel.findOne({ 
            webSiteId, 
            userId: userIdToAdd 
        });
        
        if (existingAssociation) {
            // Update the role if the association already exists
            return WebSiteUserModel.findByIdAndUpdate(
                existingAssociation._id,
                { role },
                { new: true, runValidators: true }
            );
        }
        
        // Create a new association
        return WebSiteUserModel.create({
            webSiteId,
            userId: userIdToAdd,
            role
        });
    }
    
    /**
     * Remove a user from a website
     */
    async removeUserFromWebSite(webSiteId: string, userIdToRemove: string, requestingUserId: string): Promise<any> {
        // Cannot remove the last owner
        if (requestingUserId === userIdToRemove) {
            const ownerCount = await WebSiteUserModel.countDocuments({
                webSiteId,
                role: 'owner'
            });
            
            if (ownerCount <= 1) {
                throw new AppError('Cannot remove the last owner of the website', 400);
            }
        }
        
        // Verify the requesting user has permission to remove users from this website
        const requestingWebsiteUser = await WebSiteUserModel.findOne({ 
            webSiteId, 
            userId: requestingUserId,
            role: 'owner'
        });
        
        if (!requestingWebsiteUser && requestingUserId !== userIdToRemove) {
            throw new AppError('You do not have permission to remove users from this website', 403);
        }
        
        return WebSiteUserModel.findOneAndDelete({ 
            webSiteId, 
            userId: userIdToRemove 
        });
    }
    
    /**
     * Get all users associated with a website
     */
    async getWebSiteUsers(webSiteId: string, requestingUserId: string): Promise<any[]> {
        // Verify the requesting user has access to this website
        const requestingWebsiteUser = await WebSiteUserModel.findOne({ 
            webSiteId, 
            userId: requestingUserId
        });
            
        if (!requestingWebsiteUser) {
            throw new AppError('You do not have access to this website', 403);
        }
        
        // Find all website-user relationships for this website
        const websiteUsers = await WebSiteUserModel.find({ webSiteId });
        
        // Get the user IDs
        const userIds = websiteUsers.map(wu => wu.userId);
        
        // Find all users
        const users = await UserModel.find({
            _id: { $in: userIds }
        }).select('-password -refreshToken -passwordResetToken -passwordResetExpires');
        
        // Combine user info with their role
        return users.map(user => {
            const websiteUser = websiteUsers.find(wu => 
                wu.userId.toString() === user._id.toString()
            );
            
            return {
                ...user.toObject(),
                websiteRole: websiteUser ? websiteUser.role : null
            };
        });
    }
}