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
import { withDatabaseTransaction } from "../utils/sessionManager";
import logger from "../config/logger";

export class WebSiteService {
    /**
     * Create a new website and associate it with the creator user
     */
    async createWebSite(webSiteData: WebSiteProps, userId: string): Promise<WebSiteProps> {
        return withDatabaseTransaction(async (session) => {
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
            
            
            
            return website[0];
        });
    }
    
    /**
     * Get all websites
     */
  async getAllWebSites(): Promise<WebSiteProps[]> {
        return WebSiteModel.find().lean(); 
    }
    
    /**
     * Get a website by ID
     */
     async getWebSiteById(id: string): Promise<WebSiteProps | null> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new AppError('Invalid website ID format', 400);
        }
        return WebSiteModel.findById(id).lean();
    }
    
    /**
     * Get all websites for a specific user
     */
  async getWebSitesByUserId(userId: string): Promise<WebSiteProps[]> {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new AppError('Invalid user ID format', 400);
        }
        
        // Find all website-user relationships for this user
        const websiteUsers = await WebSiteUserModel.find({ userId }).lean();
        
        // Get the website IDs
        const websiteIds = websiteUsers.map(wu => wu.webSiteId);
        
        if (websiteIds.length === 0) {
            return [];
        }
        
        // Find all websites
        return WebSiteModel.find({
            _id: { $in: websiteIds }
        }).lean();
    }

    /**
     * Upload logo image for a website
     */
    async uploadWebSiteLogo(id: string, file: File): Promise<WebSiteProps> {
        try {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new AppError('Invalid website ID format', 400);
            }
        
            const website = await WebSiteModel.findById(id);
            if (!website) {
                throw new AppError(`Website with ID ${id} not found`, 404);
            }
        
            const result = await cloudinaryService.uploadImage(file.path);
            
            website.logo = result.secure_url;
            
            if (!website.metadata) website.metadata = {};
            website.metadata.cloudinaryId = result.public_id;
            website.metadata.width = result.width;
            website.metadata.height = result.height;
            
            return await website.save();
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError('Failed to upload logo for website', 500);
        }
    }
    
    
    /**
     * Update a website by ID
     */
    async updateWebSite(id: string, updateData: Partial<WebSiteProps>, userId: string): Promise<WebSiteProps | null> {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new AppError('Invalid website ID format', 400);
            }
            
            // Verify the user has permission to update this website
            const websiteUser = await WebSiteUserModel.findOne({ 
                webSiteId: id, 
                userId,
                role: { $in: ['owner', 'editor'] }
            }).lean();
            
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
     * Delete images asynchronously to avoid blocking the main transaction
     */
    private async deleteImagesAsync(imageUrls: string[]): Promise<void> {
        if (imageUrls.length === 0) return;
        
        // Process images in batches to avoid overwhelming Cloudinary
        const batchSize = 5;
        const batches = [];
        
        for (let i = 0; i < imageUrls.length; i += batchSize) {
            batches.push(imageUrls.slice(i, i + batchSize));
        }
        
        let deletedCount = 0;
        
        for (const batch of batches) {
            const promises = batch.map(async (imageUrl) => {
                try {
                    const publicId = cloudinaryService.getPublicIdFromUrl(imageUrl);
                    if (publicId) {
                        await cloudinaryService.deleteImage(publicId);
                        deletedCount++;
                    }
                } catch (error) {
                    logger.warn(`Failed to delete image ${imageUrl}:`, error);
                }
            });
            
            await Promise.allSettled(promises);
            
            // Small delay between batches
            if (batches.indexOf(batch) < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        logger.info(`Async image deletion completed: ${deletedCount}/${imageUrls.length} images deleted`);
    }
   
    /**
     * Delete a website by ID with complete cascade deletion
     * @param id The website ID
     * @param userId The user requesting the deletion
     * @param hardDelete Whether to permanently delete (default: true for complete removal)
     * @returns Promise with deletion results
     */
async deleteWebSite(id: string, userId: string): Promise<{
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
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new AppError('Invalid website ID format', 400);
        }

        // Verify the user has permission to delete this website
        const websiteUser = await WebSiteUserModel.findOne({ 
            webSiteId: id, 
            userId,
            role: 'owner'
        }).lean();
        
        if (!websiteUser) {
            throw new AppError('You do not have permission to delete this website', 403);
        }

        return withDatabaseTransaction(async (session) => {
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
                
                logger.info('Starting website deletion cascade', {
                    websiteId: id,
                    userId
                });
                
                // Step 1: Get all related data IDs in parallel
                const [sections, sectionItems] = await Promise.all([
                    SectionModel.find({ WebSiteId: id }).select('_id image').session(session),
                    SectionItemModel.find({ WebSiteId: id }).select('_id image').session(session)
                ]);
                
                const sectionIds = sections.map(s => s._id);
                const sectionItemIds = sectionItems.map(si => si._id);
                
                // Collect images from sections and section items
                sections.forEach(section => {
                    if (section.image) imagesToDelete.push(section.image);
                });
                sectionItems.forEach(item => {
                    if (item.image) imagesToDelete.push(item.image);
                });
                
                // Step 2: Get subsections and content elements
                const [subsections, contentElements] = await Promise.all([
                    SubSectionModel.find({
                        $or: [
                            { WebSiteId: id },
                            { section: { $in: sectionIds } },
                            { sectionItem: { $in: sectionItemIds } }
                        ]
                    }).select('_id').session(session),
                    
                    ContentElementModel.find({
                        $or: [
                            { parent: id },
                            { parent: { $in: sectionIds } },
                            { parent: { $in: sectionItemIds } }
                        ]
                    }).select('_id imageUrl').session(session)
                ]);
                
                const subsectionIds = subsections.map(sub => sub._id);
                const contentElementIds = contentElements.map(ce => ce._id);
                
                // Collect images from content elements
                contentElements.forEach(element => {
                    if (element.imageUrl) imagesToDelete.push(element.imageUrl);
                });
                
                // Step 3: Bulk delete operations in optimal order
                const deletionResults = await Promise.all([
                    // Delete translations first (they reference content elements)
                    ContentTranslationModel.deleteMany({
                        contentElement: { $in: contentElementIds }
                    }).session(session),
                    
                    // Delete content elements
                    ContentElementModel.deleteMany({
                        $or: [
                            { parent: id },
                            { parent: { $in: [...sectionIds, ...sectionItemIds, ...subsectionIds] } }
                        ]
                    }).session(session),
                    
                    // Delete subsections
                    SubSectionModel.deleteMany({
                        $or: [
                            { WebSiteId: id },
                            { section: { $in: sectionIds } },
                            { sectionItem: { $in: sectionItemIds } }
                        ]
                    }).session(session),
                    
                    // Delete section items
                    SectionItemModel.deleteMany({
                        $or: [
                            { WebSiteId: id },
                            { section: { $in: sectionIds } }
                        ]
                    }).session(session),
                    
                    // Delete sections
                    SectionModel.deleteMany({
                        WebSiteId: id
                    }).session(session),
                    
                    // Delete website user associations
                    WebSiteUserModel.deleteMany({
                        webSiteId: id
                    }).session(session)
                ]);
                
                // Delete the website itself
                await WebSiteModel.findByIdAndDelete(id).session(session);
                
           
                
                // Handle image deletion outside transaction (async)
                this.deleteImagesAsync(imagesToDelete);
                
                return { 
                    success: true,
                    message: 'Website and all related data deleted successfully',
                    deletedCounts: {
                        websites: 1,
                        websiteUsers: deletionResults[5].deletedCount || 0,
                        sections: deletionResults[4].deletedCount || 0,
                        sectionItems: deletionResults[3].deletedCount || 0,
                        subsections: deletionResults[2].deletedCount || 0,
                        contentElements: deletionResults[1].deletedCount || 0,
                        contentTranslations: deletionResults[0].deletedCount || 0,
                        imagesDeleted: imagesToDelete.length
                    }
                };
                
            } catch (error) {
                logger.error(`Failed to delete website ${id}:`, {
                    error: error.message,
                    userId
                });
                throw error;
            }
        });
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