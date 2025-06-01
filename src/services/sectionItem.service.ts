import SectionItemModel from '../models/sectionItems.model';
import mongoose from 'mongoose';
import SectionModel from '../models/sections.model';
import SubSectionModel from '../models/subSections.model';
import { IService, IServiceDocument } from '../types/sectionItem.types';
import { AppError } from '../middleware/errorHandler.middleware';

class SectionItemService {
    /**
     * Create a new section item
     * @param itemData The section item data to create
     * @returns Promise with the created section item
    */
    async createSectionItem(itemData: IService): Promise<IServiceDocument> {

        try {
            // Check if the section exists
            if (itemData.subsections) {
                const sectionExists = await SectionModel.findById(itemData.subsections);
                if (!sectionExists) {
                    throw AppError.notFound(`Section with ID ${itemData.subsections} not found`);
                }
            }
            if (!itemData.WebSiteId) {
                throw AppError.notFound(`Web Site not send with the request `);
            }
            
            // Create new section item
            const sectionItem = new SectionItemModel({
                name: itemData.name,
                description: itemData.description,
                image: itemData.image,
                order: itemData.order || 0,
                isActive: itemData.isActive !== undefined ? itemData.isActive : true,
                section: itemData.section,
                isMain: itemData.isMain ,
                WebSiteId : itemData.WebSiteId
            });
            
            await sectionItem.save();
            
            // Update parent section if provided
            if (itemData.subsections) {
                await SectionModel.findByIdAndUpdate(
                    itemData.subsections,
                    { $addToSet: { sectionItems: sectionItem._id } }
                );
            }
            
            return sectionItem;
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw AppError.database('Failed to create section item', error);
        }
    }
    
    /**
     * Get all section items
     * @param activeOnly Whether to return only active items
     * @param limit Maximum number of items to return
     * @param skip Number of items to skip
     * @param includeSubSectionCount Whether to include subsection count
     * @returns Promise with array of section items
     */
    async getAllSectionItems(
        activeOnly = true, 
        limit = 100, 
        skip = 0,
        includeSubSectionCount = false
    ): Promise<IServiceDocument[]> {
        try {
            const query = activeOnly ? { isActive: true } : {};
            
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
            throw AppError.database('Failed to retrieve section items', error);
        }
    }
    
    /**
     * Get section item by ID
     * @param id The section item ID
     * @param populateSection Whether to populate parent section
     * @param includeSubSections Whether to include subsections
     * @returns Promise with the section item if found
     */
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
    includeSubSectionCount = true
): Promise<IServiceDocument[]> {
    try {
        if (!mongoose.Types.ObjectId.isValid(sectionId)) {
            throw AppError.validation('Invalid section ID format');
        }

        console.log(`Fetching section items for section ID: ${sectionId}, activeOnly: ${activeOnly}, limit: ${limit}, skip: ${skip}`);

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
            })
            .populate({
                path: 'subsections',
                match: activeOnly ? { isActive: true } : {},
                options: { sort: { order: 1 } }
            });
        
        // If requested, get subsection count for each section item
        if (includeSubSectionCount && sectionItems.length > 0) {
            const sectionItemIds = sectionItems.map(item => item._id).filter(id => id);
            
            if (sectionItemIds.length > 0) {
                // Get counts for each section item
                const subsectionCounts = await SubSectionModel.aggregate([
                    { $match: { sectionItem: { $in: sectionItemIds }, isActive: activeOnly } },
                    { $group: { _id: '$sectionItem', count: { $sum: 1 } } }
                ]).catch(err => {
                    console.error('Aggregation error:', err);
                    throw err;
                });
                
                // Create a map of section item ID to count
                const countsMap = subsectionCounts.reduce((acc, item) => {
                    acc[item._id?.toString() ?? ''] = item.count;
                    return acc;
                }, {} as { [key: string]: number });
                
                // Add count to each section item
                sectionItems.forEach(sectionItem => {
                    const id = sectionItem._id?.toString() ?? '';
                    (sectionItem as any).subsectionCount = countsMap[id] || 0;
                });
            }
        }
        
        return sectionItems;
    } catch (error) {
        console.error('Error in getSectionItemsBySectionId:', {
            sectionId,
            activeOnly,
            limit,
            skip,
            includeSubSectionCount,
            error: error.message,
            stack: error.stack,
        });
        if (error instanceof AppError) throw error;
        throw AppError.database('Failed to retrieve section items by section ID', error);
    }
}

    /**
     * Get section items by WebSite ID
     * @param websiteId The WebSite ID
     * @param activeOnly Whether to return only active items
     * @param limit Maximum number of items to return
     * @param skip Number of items to skip
     * @param includeSubSectionCount Whether to include subsection count
     * @returns Promise with array of section items
     */
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
        
    /**
     * Update section item by ID
     * @param id The section item ID
     * @param updateData The data to update
     * @returns Promise with the updated section item
     */
    async updateSectionItemById(id: string, updateData: Partial<IService>): Promise<IServiceDocument> {
        try {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw AppError.validation('Invalid section item ID format');
            }

            const sectionItem = await SectionItemModel.findById(id);
            
            if (!sectionItem) {
                throw AppError.notFound(`Section item with ID ${id} not found`);
            }
            
            // If section is being updated, check if it exists
            if (updateData.subsections && updateData.subsections.toString() !== sectionItem.subsections.toString()) {
                const sectionExists = await SectionModel.findById(updateData.subsections);
                if (!sectionExists) {
                    throw AppError.notFound(`Section with ID ${updateData.subsections} not found`);
                }
                
                // Update old section (remove this item)
                await SectionModel.findByIdAndUpdate(
                    sectionItem.subsections,
                    { $pull: { sectionItems: sectionItem._id } }
                );
                
                // Update new section (add this item)
                await SectionModel.findByIdAndUpdate(
                    updateData.subsections,
                    { $addToSet: { sectionItems: sectionItem._id } }
                );
            }
            
            // Update the section item
            const updatedSectionItem = await SectionItemModel.findByIdAndUpdate(
                id,
                { $set: updateData },
                { new: true, runValidators: true }
            ).populate('section');
            
            return updatedSectionItem;
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw AppError.database('Failed to update section item', error);
        }
    }
    
    /**
     * Delete section item by ID
     * @param id The section item ID
     * @param hardDelete Whether to permanently delete
     * @returns Promise with the result of the deletion
     */
    async deleteSectionItemById(id: string, hardDelete = false): Promise<{ success: boolean; message: string }> {
        try {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw AppError.validation('Invalid section item ID format');
            }

            const sectionItem = await SectionItemModel.findById(id);
            
            if (!sectionItem) {
                throw AppError.notFound(`Section item with ID ${id} not found`);
            }

            if (hardDelete) {
                // Check if there are subsections associated with this section item
                const subsectionsCount = await SubSectionModel.countDocuments({ sectionItem: id });
                if (subsectionsCount > 0) {
                    throw AppError.badRequest(`Cannot hard delete section item with ${subsectionsCount} associated subsections`);
                }

                // Permanently delete
                await SectionItemModel.findByIdAndDelete(id);
                
                // Remove this item from parent section
                await SectionModel.findByIdAndUpdate(
                    sectionItem.subsections,
                    { $pull: { sectionItems: id } }
                );
                
                return { success: true, message: 'Section item deleted successfully' };
            } else {
                // Soft delete
                await SectionItemModel.findByIdAndUpdate(id, { isActive: false });
                
                // Also mark all associated subsections as inactive
                await SubSectionModel.updateMany(
                    { sectionItem: id },
                    { isActive: false }
                );
                
                return { success: true, message: 'Section item deactivated successfully' };
            }
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw AppError.database('Failed to delete section item', error);
        }
    }

    /**
     * Bulk update section item order
     * @param sectionItems Array of { id, order } objects
     * @returns Promise with success message
     */
    async updateSectionItemsOrder(sectionItems: { id: string; order: number }[]): Promise<{ success: boolean; message: string }> {
        try {
            const bulkOps = sectionItems.map(item => ({
                updateOne: {
                    filter: { _id: new mongoose.Types.ObjectId(item.id) },
                    update: { $set: { order: item.order } }
                }
            }));

            if (bulkOps.length > 0) {
                await SectionItemModel.bulkWrite(bulkOps);
            }

            return { success: true, message: `Updated order for ${sectionItems.length} section items` };
        } catch (error) {
            throw AppError.database('Failed to update section items order', error);
        }
    }
}

export default new SectionItemService();