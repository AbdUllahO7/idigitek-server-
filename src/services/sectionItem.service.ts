import SectionItemModel from '../models/sectionItems.model';
import mongoose from 'mongoose';
import SectionModel from '../models/sections.model';
import SubSectionModel from '../models/subSections.model';
import { IService, IServiceDocument } from '../types/sectionItem.types';
import { AppError } from '../middleware/errorHandler.middleware';
import ContentElementModel from '../models/ContentElement.model';
import ContentTranslationModel from '../models/ContentTranslation.model';
import cacheService from './cache.service';

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
): Promise<any[]> {
    try {
        // Check cache first
        const cacheKey = `all_sectionitems_${activeOnly}_${limit}_${skip}_${includeSubSectionCount}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        const query = activeOnly ? { isActive: true } : {};
        
        // Use lean() for better performance
        const sectionItems = await SectionItemModel.find(query, {
            // Project only needed fields
            name: 1,
            description: 1,
            image: 1,
            isActive: 1,
            order: 1,
            isMain: 1,
            WebSiteId: 1,
            section: 1,
            subsections: 1,
            createdAt: 1,
            updatedAt: 1
        })
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
            path: 'section',
            match: activeOnly ? { isActive: true } : {},
            select: 'name subName isActive order',
            options: { sort: { order: 1 } }
        })
        .lean();

        // Add subsection count if requested
        if (includeSubSectionCount && sectionItems.length > 0) {
            const sectionItemIds = sectionItems.map(item => item._id);
            
            const subsectionCounts = await SubSectionModel.aggregate([
                { 
                    $match: { 
                        sectionItem: { $in: sectionItemIds },
                        ...(activeOnly && { isActive: true })
                    }
                },
                { $group: { _id: '$sectionItem', count: { $sum: 1 } } }
            ]);
            
            const countsMap = subsectionCounts.reduce((acc, item) => {
                acc[item._id.toString()] = item.count;
                return acc;
            }, {} as { [key: string]: number });
            
            sectionItems.forEach(sectionItem => {
                sectionItem.subsectionCount = countsMap[sectionItem._id.toString()] || 0;
            });
        }
        
        // Cache for 2 minutes
        await cacheService.set(cacheKey, sectionItems, { ttl: 120 });
        
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
): Promise<any> {
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw AppError.validation('Invalid section item ID format');
        }

        // Check cache first
        const cacheKey = `sectionitem_${id}_${populateSection}_${includeSubSections}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        const pipeline = [
            { $match: { _id: new mongoose.Types.ObjectId(id) } },
            
            // Conditionally lookup section
            ...(populateSection ? [{
                $lookup: {
                    from: 'sections',
                    localField: 'section',
                    foreignField: '_id',
                    as: 'section'
                }
            }, {
                $unwind: { path: '$section', preserveNullAndEmptyArrays: true }
            }] : []),
            
            // Conditionally include subsections
            ...(includeSubSections ? [{
                $lookup: {
                    from: 'subsections',
                    localField: '_id',
                    foreignField: 'sectionItem',
                    as: 'subsections',
                    pipeline: [
                        { $match: { isActive: true } },
                        { $sort: { order: 1 } }
                    ]
                }
            }] : [])
        ];

        const result = await SectionItemModel.aggregate(pipeline);
        
        if (!result || result.length === 0) {
            throw AppError.notFound(`Section item with ID ${id} not found`);
        }

        const sectionItem = result[0];
        
        // Cache for 5 minutes
        await cacheService.set(cacheKey, sectionItem, { ttl: 300 });
        
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
    ): Promise<any[]> {
        try {
            if (!mongoose.Types.ObjectId.isValid(sectionId)) {
                throw AppError.validation('Invalid section ID format');
            }

            // Check cache first
            const cacheKey = `sectionitems_section_${sectionId}_${activeOnly}_${limit}_${skip}_${includeSubSectionCount}`;
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                return cached;
            }

            const matchStage: any = { section: new mongoose.Types.ObjectId(sectionId) };
            if (activeOnly) {
                matchStage.isActive = true;
            }

            const pipeline = [
                { $match: matchStage },
                { $sort: { order: 1, createdAt: -1 } },
                { $skip: skip },
                { $limit: limit },
                
                // Lookup section
                {
                    $lookup: {
                        from: 'sections',
                        localField: 'section',
                        foreignField: '_id',
                        as: 'section',
                        pipeline: activeOnly ? [{ $match: { isActive: true } }] : []
                    }
                },
                
                // Lookup subsections with count
                {
                    $lookup: {
                        from: 'subsections',
                        let: { sectionItemId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ['$sectionItem', '$$sectionItemId'] },
                                    ...(activeOnly && { isActive: true })
                                }
                            },
                            { $sort: { order: 1 } }
                        ],
                        as: 'subsections'
                    }
                },
                
                // Add subsection count if requested
                ...(includeSubSectionCount ? [{
                    $addFields: {
                        subsectionCount: { $size: '$subsections' }
                    }
                }] : []),
                
                // Unwind section
                { $unwind: { path: '$section', preserveNullAndEmptyArrays: true } }
            ];

            const result = await SectionItemModel.aggregate(pipeline);
            
            // Cache for 3 minutes
            await cacheService.set(cacheKey, result, { ttl: 180 });
            
            return result;
        } catch (error) {
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
): Promise<any[]> {
    try {
        if (!mongoose.Types.ObjectId.isValid(websiteId)) {
            throw AppError.validation('Invalid WebSite ID format');
        }

        // Check cache first
        const cacheKey = `sectionitems_website_${websiteId}_${activeOnly}_${limit}_${skip}_${includeSubSectionCount}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        const matchStage: any = { WebSiteId: new mongoose.Types.ObjectId(websiteId) };
        if (activeOnly) {
            matchStage.isActive = true;
        }

        const pipeline = [
            { $match: matchStage },
            { $sort: { order: 1, createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            
            // Lookup section
            {
                $lookup: {
                    from: 'sections',
                    localField: 'section',
                    foreignField: '_id',
                    as: 'section',
                    pipeline: activeOnly ? [{ $match: { isActive: true } }] : []
                }
            },
            
            // Conditionally add subsection count
            ...(includeSubSectionCount ? [{
                $lookup: {
                    from: 'subsections',
                    let: { sectionItemId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$sectionItem', '$$sectionItemId'] },
                                ...(activeOnly && { isActive: true })
                            }
                        },
                        { $count: 'count' }
                    ],
                    as: 'subsectionCount'
                }
            }, {
                $addFields: {
                    subsectionCount: { $ifNull: [{ $arrayElemAt: ['$subsectionCount.count', 0] }, 0] }
                }
            }] : []),
            
            // Unwind section
            { $unwind: { path: '$section', preserveNullAndEmptyArrays: true } }
        ];

        const result = await SectionItemModel.aggregate(pipeline);
        
        // Cache for 3 minutes
        await cacheService.set(cacheKey, result, { ttl: 180 });
        
        return result;
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
     * Delete section item by ID with complete cascade deletion
     * @param id The section item ID
     * @param hardDelete Whether to permanently delete (default: true for complete removal)
     * @returns Promise with the result of the deletion
     */
    async deleteSectionItemById(id: string, hardDelete = true): Promise<{ 
        success: boolean; 
        message: string;
        deletedCounts?: {
            sectionItems: number;
            subsections: number;
            contentElements: number;
            contentTranslations: number;
        }
    }> {
      

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            
            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw AppError.validation('Invalid section item ID format');
            }

            // Get the section item with its image
            const sectionItem = await SectionItemModel.findById(id).session(session);
            if (!sectionItem) {
                throw AppError.notFound(`Section item with ID ${id} not found`);
            }
            
            // Store the image URL and parent section for later operations
            const imageUrl = sectionItem.image;
            const parentSectionId = sectionItem.section;
            
            // STEP 1: Find all SubSections belonging to this section item
            const subsections = await SubSectionModel.find({ 
                sectionItem: id 
            }).session(session);
            const subsectionIds = subsections.map(subsection => subsection._id);
            
            // STEP 2: Find all ContentElements for section item and its subsections
            const contentElements = await ContentElementModel.find({
                $or: [
                    // Elements directly belonging to the section item
                    { parent: id },
                    // Elements belonging to subsections
                    { parent: { $in: subsectionIds } },
                    // Legacy format - if you're using parentType/parentId
                    { parentType: 'sectionItem', parentId: id },
                    { parentType: 'subsection', parentId: { $in: subsectionIds } }
                ]
            }).session(session);
            const contentElementIds = contentElements.map(element => element._id);
            
            // STEP 3: Delete all ContentTranslations for these elements
            const deletedTranslations = await ContentTranslationModel.deleteMany({
                $or: [
                    { contentElement: { $in: contentElementIds } },
                    { elementId: { $in: contentElementIds } } // Handle both field names
                ]
            }).session(session);
            
            // STEP 4: Delete all ContentElements
            const deletedElements = await ContentElementModel.deleteMany({
                $or: [
                    // Elements directly belonging to the section item
                    { parent: id },
                    // Elements belonging to subsections
                    { parent: { $in: subsectionIds } },
                    // Legacy format
                    { parentType: 'sectionItem', parentId: id },
                    { parentType: 'subsection', parentId: { $in: subsectionIds } }
                ]
            }).session(session);
            
            // STEP 5: Delete all SubSections
            const deletedSubsections = await SubSectionModel.deleteMany({
                sectionItem: id
            }).session(session);
            
            // STEP 6: Remove this section item from parent section's sectionItems array
            if (parentSectionId) {
                await SectionModel.findByIdAndUpdate(
                    parentSectionId,
                    { $pull: { sectionItems: id } }
                ).session(session);
            }
            
            // STEP 7: Finally, delete the section item itself
            const deletedSectionItem = await SectionItemModel.findByIdAndDelete(id).session(session);
            
            // Commit the transaction
            await session.commitTransaction();
            
            // STEP 8: Delete the image from Cloudinary if it exists (after transaction is committed)
            if (imageUrl) {
                try {
                    const cloudinaryService = require('../services/cloudinary.service').default;
                    const publicId = cloudinaryService.getPublicIdFromUrl(imageUrl);
                    if (publicId) {
                        // Delete in the background, don't wait for it
                        cloudinaryService.deleteImage(publicId).catch((err: any) => {
                            console.error('Failed to delete section item image:', err);
                        });
                    }
                } catch (error) {
                    console.error('Error importing cloudinary service:', error);
                }
            }
            
            return { 
                success: true,
                message: 'Section item and all related data deleted successfully',
                deletedCounts: {
                    sectionItems: 1,
                    subsections: deletedSubsections.deletedCount,
                    contentElements: deletedElements.deletedCount,
                    contentTranslations: deletedTranslations.deletedCount
                }
            };
            
        } catch (error) {
            await session.abortTransaction();
            console.error(`❌ Error deleting section item ${id}:`, error);
            if (error instanceof AppError) throw error;
            throw AppError.database('Failed to delete section item', error);
        } finally {
            session.endSession();
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