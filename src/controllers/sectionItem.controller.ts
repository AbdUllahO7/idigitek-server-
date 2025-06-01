import { Request, Response } from 'express';
import { sendSuccess } from '../utils/responseHandler';
import { AppError, asyncHandler } from '../middleware/errorHandler.middleware';
import mongoose from 'mongoose';
import sectionItemService from '../services/sectionItem.service';

class SectionItemController {
  /**
   * Create a new section item
   * @route POST /api/section-items
   */
  createSectionItem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const sectionItem = await sectionItemService.createSectionItem(req.body);
    sendSuccess(res, sectionItem, 'Section item created successfully', 201);
  });
  
  /**
   * Get all section items
   * @route GET /api/section-items
   */
  getAllSectionItems = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeOnly = req.query.activeOnly !== 'false';
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = parseInt(req.query.skip as string) || 0;
    const includeSubSectionCount = req.query.includeSubSectionCount === 'true';
    
    const sectionItems = await sectionItemService.getAllSectionItems(
      activeOnly, 
      limit, 
      skip,
      includeSubSectionCount
    );
    
    sendSuccess(res, sectionItems, 'Section items retrieved successfully');
  });
  
  /**
   * Get section item by ID
   * @route GET /api/section-items/:id
   */
  getSectionItemById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const populateSection = req.query.populate !== 'false';
    const includeSubSections = req.query.includeSubSections === 'true';
    
    const sectionItem = await sectionItemService.getSectionItemById(
      req.params.id, 
      populateSection,
      includeSubSections
    );
    
    sendSuccess(res, sectionItem, 'Section item retrieved successfully');
  });
  
  /**
   * Get section items by parent section ID
   * @route GET /api/section-items/section/:sectionId
   */
  getSectionItemsBySectionId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const activeOnly = req.query.activeOnly !== 'false';
      const limit = parseInt(req.query.limit as string) || 100;
      const skip = parseInt(req.query.skip as string) || 0;
      const includeSubSectionCount = req.query.includeSubSectionCount === 'true';
      
      const sectionItems = await sectionItemService.getSectionItemsBySectionId(
        req.params.sectionId,
        activeOnly,
        limit,
        skip,
        includeSubSectionCount
      );
      
      sendSuccess(res, sectionItems, 'Section items retrieved successfully');
  });

  /**
   * Get section items by WebSite ID
   * @route GET /api/section-items/website/:websiteId
   */
  getSectionItemsByWebSiteId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeOnly = req.query.activeOnly !== 'false';
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = parseInt(req.query.skip as string) || 0;
    const includeSubSectionCount = req.query.includeSubSectionCount === 'true';
    
    const sectionItems = await sectionItemService.getSectionItemsByWebSiteId(
        req.params.websiteId,
        activeOnly,
        limit,
        skip,
        includeSubSectionCount
    );
    
    sendSuccess(res, sectionItems, 'Section items retrieved successfully');
  });
    
  
  /**
   * Update section item by ID
   * @route PUT /api/section-items/:id
   */
  updateSectionItem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw AppError.validation('Invalid section item ID format');
    }
    
    const sectionItem = await sectionItemService.updateSectionItemById(
      req.params.id, 
      req.body
    );
    
    sendSuccess(res, sectionItem, 'Section item updated successfully');
  });
  
  /**
   * Delete section item by ID
   * @route DELETE /api/section-items/:id
   */
  deleteSectionItem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw AppError.validation('Invalid section item ID format');
    }
    
    const hardDelete = req.query.hardDelete === 'true';
    const result = await sectionItemService.deleteSectionItemById(req.params.id, hardDelete);
    
    sendSuccess(res, result, result.message);
  });
  
  /**
   * Update order of multiple section items
   * @route PUT /api/section-items/order
   */
  updateSectionItemsOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sectionItems } = req.body;
    
    if (!sectionItems || !Array.isArray(sectionItems) || sectionItems.length === 0) {
      throw AppError.badRequest('Valid section items array is required');
    }
    
    // Validate each section item in the array
    sectionItems.forEach(item => {
      if (!item.id || !mongoose.Types.ObjectId.isValid(item.id)) {
        throw AppError.validation(`Invalid section item ID: ${item.id}`);
      }
      
      if (typeof item.order !== 'number') {
        throw AppError.validation(`Order must be a number for section item ID: ${item.id}`);
      }
    });
    
    const result = await sectionItemService.updateSectionItemsOrder(sectionItems);
    
    sendSuccess(res, result, result.message);
  });
}

export default new SectionItemController();