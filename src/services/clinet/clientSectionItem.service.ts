import mongoose from "mongoose";
import { AppError } from "../../middleware/errorHandler.middleware";
import SectionItemModel from "../../models/sectionItems.model";
import SubSectionModel from "../../models/subSections.model";
import { IServiceDocument } from "../../types/sectionItem.types";


class ClientSectionItems {
        async getSectionItemById(
            id: string, 
            populateSection = true,
            includeSubSections = false
        ): Promise<IServiceDocument> {
            try {
                if (!mongoose.Types.ObjectId.isValid(id)) {
                    throw AppError.validation('Invalid section item ID format');
                }
    
                const query = SectionItemModel.findById(id);
                
                if (populateSection) {
                    query.populate('section');
                }
                
                const sectionItem = await query.exec();
                
                if (!sectionItem) {
                    throw AppError.notFound(`Section item with ID ${id} not found`);
                }
                
                // If requested, include subsections
                if (includeSubSections) {
                    const subsections = await SubSectionModel.find({
                        sectionItem: id,
                        isActive: true
                    }).sort({ order: 1 });
                    
                    // Add subsections to the result
                    (sectionItem as any).subsections = subsections;
                }
                
                return sectionItem;
            } catch (error) {
                if (error instanceof AppError) throw error;
                throw AppError.database('Failed to retrieve section item', error);
            }
        }
        
        /**
         * Get section items by parent section ID
         * @param sectionId The parent section ID
         * @param activeOnly Whether to return only active items
         * @param limit Maximum number of items to return
         * @param skip Number of items to skip
         * @param includeSubSectionCount Whether to include subsection count
         * @returns Promise with array of section items
         */
        async getSectionItemsBySectionId(
            sectionId: string,
            activeOnly = true,
            limit = 100,
            skip = 0,
            includeSubSectionCount = false
        ): Promise<IServiceDocument[]> {
            try {
                if (!mongoose.Types.ObjectId.isValid(sectionId)) {
                    throw AppError.validation('Invalid section ID format');
                }
    
                // Build the query
                const query: any = { 
                    section: sectionId 
                };
                
                if (activeOnly) {
                    query.isActive = true;
                }
                
                const sectionItems = await SectionItemModel.find(query)
                    .sort({ order: 1, createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .populate({
                        path: 'section',
                        match: activeOnly ? { isActive: true } : {},
                        options: { sort: { order: 1 } }
                    });
                
                // If requested, get subsection count for each section item
                if (includeSubSectionCount && sectionItems.length > 0) {
                    const sectionItemIds = sectionItems.map(item => item._id);
                    
                    // Get counts for each section item
                    const subsectionCounts = await SubSectionModel.aggregate([
                        { $match: { sectionItem: { $in: sectionItemIds }, isActive: activeOnly } },
                        { $group: { _id: '$sectionItem', count: { $sum: 1 } } }
                    ]);
                    
                    // Create a map of section item ID to count
                    const countsMap = subsectionCounts.reduce((acc, item) => {
                        acc[item._id.toString()] = item.count;
                        return acc;
                    }, {} as { [key: string]: number });
                    
                    // Add count to each section item
                    sectionItems.forEach(sectionItem => {
                        const id = sectionItem._id.toString();
                        (sectionItem as any).subsectionCount = countsMap[id] || 0;
                    });
                }
                
                return sectionItems;
            } catch (error) {
                if (error instanceof AppError) throw error;
                throw AppError.database('Failed to retrieve section items by section ID', error);
            }
        }


        async getSectionItemsByWebSiteId(
            websiteId: string,
            activeOnly = true,
            limit = 100,
            skip = 0,
            includeSubSectionCount = false
        ): Promise<IServiceDocument[]> {
            try {
                if (!mongoose.Types.ObjectId.isValid(websiteId)) {
                    throw AppError.validation('Invalid WebSite ID format');
                }
    
                // Build the query
                const query: any = { 
                    WebSiteId: websiteId 
                };
                
                if (activeOnly) {
                    query.isActive = true;
                }
                
                const sectionItems = await SectionItemModel.find(query)
                    .sort({ order: 1, createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .populate({
                        path: 'section',
                        match: activeOnly ? { isActive: true } : {},
                        options: { sort: { order: 1 } }
                    });
                
                // If requested, get subsection count for each section item
                if (includeSubSectionCount && sectionItems.length > 0) {
                    const sectionItemIds = sectionItems.map(item => item._id);
                    
                    // Get counts for each section item
                    const subsectionCounts = await SubSectionModel.aggregate([
                        { $match: { sectionItem: { $in: sectionItemIds }, isActive: activeOnly } },
                        { $group: { _id: '$sectionItem', count: { $sum: 1 } } }
                    ]);
                    
                    // Create a map of section item ID to count
                    const countsMap = subsectionCounts.reduce((acc, item) => {
                        acc[item._id.toString()] = item.count;
                        return acc;
                    }, {} as { [key: string]: number });
                    
                    // Add count to each section item
                    sectionItems.forEach(sectionItem => {
                        const id = sectionItem._id.toString();
                        (sectionItem as any).subsectionCount = countsMap[id] || 0;
                    });
                }
                
                return sectionItems;
            } catch (error) {
                if (error instanceof AppError) throw error;
                throw AppError.database('Failed to retrieve section items by WebSite ID', error);
            }
            }
}

export default new ClientSectionItems();