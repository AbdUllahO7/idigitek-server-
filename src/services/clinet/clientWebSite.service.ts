import mongoose from "mongoose";
import { AppError } from "../../middleware/errorHandler.middleware";
import WebSiteModel from "../../models/WebSite.model";
import WebSiteUserModel from "../../models/webSiteUser.model";
import { WebSiteProps } from "../../types/WebSite.type";


export class ClientWebSiteService {
    /**
     * Get all websites for a specific user with sections and languages
     */
// ClientWebSiteService.ts
async getWebSitesByUserIdWithDetails(userId: string): Promise<WebSiteProps[]> {
    try {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new AppError('Invalid user ID format', 400);
        }

        const websiteUsers = await WebSiteUserModel.find({ userId });

        const websiteIds = websiteUsers.map(wu => wu.webSiteId);

        if (!websiteIds.length) {
            return [];
        }

        const websites = await WebSiteModel.find({
            _id: { $in: websiteIds }
        })
            .populate({
                path: 'sections',
                model: 'Sections',
                select: 'name description image isActive order sectionItems createdAt updatedAt',
                populate: {
                    path: 'sectionItems',
                    model: 'SectionItems', // Ensure this matches the registered model name
                    select: 'name description image isActive order createdAt updatedAt'
                }
            })
            .populate({
                path: 'languages',
                model: 'Languages',
                select: 'language languageID websiteId isActive createdAt updatedAt'
            });
        return websites;
    } catch (error: any) {
        console.error('Error in getWebSitesByUserIdWithDetails:', {
            message: error.message,
            name: error.name,
            stack: error.stack
        });
        if (error instanceof AppError) throw error;
        if (error.name === 'CastError') {
            throw new AppError('Invalid data format in database query', 400);
        }
        throw new AppError(`Failed to fetch websites: ${error.message}`, 500);
    }
}
}