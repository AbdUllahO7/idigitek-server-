import mongoose from "mongoose";
import { AppError } from "../middleware/errorHandler.middleware";
import UserModel from "../models/user.model";
import WebSiteModel from "../models/WebSite.model";
import WebSiteUserModel from "../models/webSiteUser.model";
import { WebSiteProps } from "../types/WebSite.type";
import cloudinaryService from "./cloudinary.service";
import { File } from 'multer';

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
    async deleteWebSite(id: string, userId: string): Promise<WebSiteProps | null> {
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
            // Delete all user associations for this website
            await WebSiteUserModel.deleteMany({ webSiteId: id }, { session });
            
            // Delete the website
            const deletedWebsite = await WebSiteModel.findByIdAndDelete(id).session(session);
            
            await session.commitTransaction();
            return deletedWebsite;
        } catch (error) {
            await session.abortTransaction();
            throw error;
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