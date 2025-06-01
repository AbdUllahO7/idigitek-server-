import { Request, Response } from 'express';
import { sendSuccess } from '../utils/responseHandler';
import mongoose from 'mongoose';
import subSectionService from '../services/subSection.service';
import { AppError, asyncHandler } from '../middleware/errorHandler.middleware';

class SubSectionController {
  /**
   * Create a new subsection
   * @route POST /api/subsections
   */
  createSubSection = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const subsection = await subSectionService.createSubSection(req.body);
    sendSuccess(res, subsection, 'Subsection created successfully', 201);
  });
  
  /**
   * Get all subsections
   * @route GET /api/subsections
   */
  getAllSubSections = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeOnly = req.query.activeOnly !== 'false';
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = parseInt(req.query.skip as string) || 0;
    const includeContentCount = req.query.includeContentCount === 'true';
    
    const subsections = await subSectionService.getAllSubSections(
      activeOnly, 
      limit, 
      skip,
      includeContentCount
    );
    
    sendSuccess(res, subsections, 'Subsections retrieved successfully');
  });


  /**
   * Get subsection by ID
   * @route GET /api/subsections/:id
   */
  getSubSectionById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const populateSectionItem = req.query.populate !== 'false';
    const includeContentElements = req.query.includeContent === 'true';
    
    const subsection = await subSectionService.getSubSectionById(
      req.params.id, 
      populateSectionItem,
      includeContentElements
    );
    
    sendSuccess(res, subsection, 'Subsection retrieved successfully');
  });

  /**
   * Get complete subsections by section ID with all content elements and translations
   * @route GET /api/subsections/section/:sectionId/complete
   */
  getCompleteSubSectionsBySectionId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeOnly = req.query.activeOnly !== 'false';
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = parseInt(req.query.skip as string) || 0;
    
    const subsections = await subSectionService.getCompleteSubSectionsBySectionId(
      req.params.sectionId,
      activeOnly,
      limit,
      skip
    );
    
    sendSuccess(res, subsections, 'Complete subsections retrieved successfully');
  });

  /**
   * Get main subsection for a section
   * @route GET /api/subsections/section/:sectionId/main
   */
  getMainSubSectionBySectionId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const mainSubsection = await subSectionService.getMainSubSectionBySectionId(
      req.params.sectionId
    );
    
    if (!mainSubsection) {
      sendSuccess(res, null, 'No main subsection found for this section');
      return;
    }
    
    sendSuccess(res, mainSubsection, 'Main subsection retrieved successfully');
  });
  
  
  /**
   * Get subsection by slug
   * @route GET /api/subsections/slug/:slug
   */
  getSubSectionBySlug = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const populateSectionItem = req.query.populate !== 'false';
    const includeContentElements = req.query.includeContent === 'true';
    
    const subsection = await subSectionService.getSubSectionBySlug(
      req.params.slug, 
      populateSectionItem,
      includeContentElements
    );
    
    sendSuccess(res, subsection, 'Subsection retrieved successfully');
  });

  
  /**
   * Update subsection by ID
   * @route PUT /api/subsections/:id
   */
  updateSubSection = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw AppError.validation('Invalid subsection ID format');
    }
    
    const subsection = await subSectionService.updateSubSectionById(
      req.params.id, 
      req.body
    );
    
    sendSuccess(res, subsection, 'Subsection updated successfully');
  });
  
  /**
   * Delete subsection by ID
   * @route DELETE /api/subsections/:id
   */
  deleteSubSection = asyncHandler(async (req: Request, res: Response): Promise<void> => {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw AppError.validation('Invalid subsection ID format');
      }
      
      const hardDelete = req.query.hardDelete === 'true';
      const result = await subSectionService.deleteSubSectionById(req.params.id, hardDelete);
      
      sendSuccess(res, result, result.message);
  });
  
  /**
   * Update order of multiple subsections
   * @route PUT /api/subsections/order
   */
  updateSubsectionsOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { subsections } = req.body;
    
    if (!subsections || !Array.isArray(subsections) || subsections.length === 0) {
      throw AppError.badRequest('Valid subsections array is required');
    }
    
    // Validate each subsection in the array
    subsections.forEach(subsection => {
      if (!subsection.id || !mongoose.Types.ObjectId.isValid(subsection.id)) {
        throw AppError.validation(`Invalid subsection ID: ${subsection.id}`);
      }
      
      if (typeof subsection.order !== 'number') {
        throw AppError.validation(`Order must be a number for subsection ID: ${subsection.id}`);
      }
    });
    
    const result = await subSectionService.updateSubsectionsOrder(subsections);
    
    sendSuccess(res, result, result.message);
  });

  /**
   * Get complete subsection by ID with all content elements and translations
   * @route GET /api/subsections/:id/complete
   */
  getCompleteSubSectionById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const populateSectionItem = req.query.populate !== 'false';
            console.log("getCompleteSubSectionById" ,  req.params.id, )

    const subsection = await subSectionService.getCompleteSubSectionById(
      req.params.id, 
      populateSectionItem
    );
    
    sendSuccess(res, subsection, 'Complete subsection data retrieved successfully');
  });
    
  /**
   * Get complete subsection by slug with all content elements and translations
   * @route GET /api/subsections/slug/:slug/complete
   */
  getCompleteSubSectionBySlug = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const populateSectionItem = req.query.populate !== 'false';
    
    const subsection = await subSectionService.getCompleteSubSectionBySlug(
      req.params.slug, 
      populateSectionItem
    );
    
    sendSuccess(res, subsection, 'Complete subsection data retrieved successfully');
  });

  /**
   * Get subsections by section item ID
   * @route GET /api/subsections/sectionItem/:sectionItemId
   */
  getSubSectionsBySectionItemId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeOnly = req.query.activeOnly !== 'false';
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = parseInt(req.query.skip as string) || 0;
    const includeContentCount = req.query.includeContentCount === 'true';
    
    const subsections = await subSectionService.getSubSectionsBySectionItemId(
      req.params.sectionItemId,
      activeOnly,
      limit,
      skip,
      includeContentCount
    );
    
    sendSuccess(res, subsections, 'Subsections retrieved successfully');
  });
  /**
 * Get subsections by WebSite ID
 * @route GET /api/subsections/website/:websiteId
 */
  getSubSectionsByWebSiteId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeOnly = req.query.activeOnly !== 'false';
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = parseInt(req.query.skip as string) || 0;
    const includeContentCount = req.query.includeContentCount === 'true';
    
    const subsections = await subSectionService.getSubSectionsByWebSiteId(
      req.params.websiteId,
      activeOnly,
      limit,
      skip,
      includeContentCount
    );
    
    sendSuccess(res, subsections, 'Subsections retrieved successfully');
  });

  /**
   * Get complete subsections by WebSite ID with all content elements and translations
   * @route GET /api/subsections/website/:websiteId/complete
   */
  getCompleteSubSectionsByWebSiteId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeOnly = req.query.activeOnly !== 'false';
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = parseInt(req.query.skip as string) || 0;
    
    const subsections = await subSectionService.getCompleteSubSectionsByWebSiteId(
      req.params.websiteId,
      activeOnly,
      limit,
      skip
    );
    
    sendSuccess(res, subsections, 'Complete subsections retrieved successfully');
  });
  /**
 * Get main subsection for a WebSite
 * @route GET /api/subsections/website/:websiteId/main
 */
  getMainSubSectionByWebSiteId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const mainSubsection = await subSectionService.getMainSubSectionByWebSiteId(
        req.params.websiteId
    );
    
    if (!mainSubsection) {
        sendSuccess(res, null, 'No main subsection found for this WebSite');
        return;
    }
    
    sendSuccess(res, mainSubsection, 'Main subsection retrieved successfully');
  });

  /**
 * Toggle active status for a subsection
 * @route PATCH /api/subsections/:id/toggle-active
  */
  toggleSubSectionActive = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw AppError.validation('Invalid subsection ID format');
    }
    
    const { status } = req.body;
    
    if (typeof status !== 'boolean') {
      throw AppError.validation('Status must be a boolean value');
    }
    
    const subsection = await subSectionService.toggleSubSectionActiveStatus(
      req.params.id, 
      status
    );
    
    sendSuccess(res, subsection, `Subsection ${status ? 'activated' : 'deactivated'} successfully`);
  });

  /**
   * Update order for a specific subsection
   * @route PATCH /api/subsections/:id/order
   */
  updateSubSectionOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw AppError.validation('Invalid subsection ID format');
    }
    
    const { order } = req.body;
    
    if (typeof order !== 'number') {
      throw AppError.validation('Order must be a number');
    }
    
    const subsection = await subSectionService.updateSubSectionOrder(
      req.params.id, 
      order
    );
    
    sendSuccess(res, subsection, 'Subsection order updated successfully');
  });

/**
 * Reorder all subsections within a section item to ensure sequential ordering
 * @route POST /api/subsections/sectionItem/:sectionItemId/reorder
 */
  reorderSubSectionsInSectionItem = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!mongoose.Types.ObjectId.isValid(req.params.sectionItemId)) {
      throw AppError.validation('Invalid section item ID format');
    }
    
    const result = await subSectionService.reorderSubSectionsInSectionItem(
      req.params.sectionItemId
    );
    
    sendSuccess(res, result, result.message);
  });

/**
 * Move a subsection up or down in order
 * @route PATCH /api/subsections/:id/move/:direction
  */
  moveSubSection = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw AppError.validation('Invalid subsection ID format');
    }
    
    const direction = req.params.direction as 'up' | 'down';
    
    if (direction !== 'up' && direction !== 'down') {
      throw AppError.validation('Direction must be either "up" or "down"');
    }
    
    const subsection = await subSectionService.moveSubSection(
      req.params.id, 
      direction
    );
    
    sendSuccess(res, subsection, `Subsection moved ${direction} successfully`);
  });
  /**
 * Activate or deactivate a subsection with special business logic
 * @route PATCH /api/subsections/:id/activate
  */
  activateDeactivateSubSection = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw AppError.validation('Invalid subsection ID format');
    }
    
    const { isActive, affectChildren = true, recursive = false } = req.body;
    
    if (typeof isActive !== 'boolean') {
      throw AppError.validation('isActive must be a boolean value');
    }
    
    const subsection = await subSectionService.activateDeactivateSubSection(
      req.params.id, 
      isActive,
      affectChildren,
      recursive
    );
    
    sendSuccess(res, subsection, `Subsection ${isActive ? 'activated' : 'deactivated'} successfully`);
  });

   /**
     * Get subsections by multiple section item IDs
     * @route POST /api/subsections/sectionItems
     */
    getSubSectionsBySectionItemIds = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { sectionItemIds } = req.body;
        console.log('sectionItemIds:', sectionItemIds);
        const activeOnly = req.query.activeOnly !== 'false';
        const limit = parseInt(req.query.limit as string) || 100;
        const skip = parseInt(req.query.skip as string) || 0;
        const includeContentCount = req.query.includeContentCount === 'true';
        
        if (!sectionItemIds || !Array.isArray(sectionItemIds) || sectionItemIds.length === 0) {
            throw AppError.badRequest('Valid sectionItemIds array is required');
        }

        // Validate each section item ID
        sectionItemIds.forEach((id: string) => {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw AppError.validation(`Invalid section item ID: ${id}`);
            }
        });
        
        const subsections = await subSectionService.getSubSectionsBySectionItemIds(
            sectionItemIds,
            activeOnly,
            limit,
            skip,
            includeContentCount
        );
        
        sendSuccess(res, subsections, 'Subsections retrieved successfully');
    });


}

export default new SubSectionController();