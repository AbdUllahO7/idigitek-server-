import { asyncHandler } from "../../middleware/errorHandler.middleware";
import { Request, Response } from 'express';
import clientSectionItemService from "../../services/clinet/clientSectionItem.service";
import { sendSuccess } from "../../utils/responseHandler";

class ClientSectionItemsController {
     /**
       * Get section item by ID
       * @route GET /api/section-items/:id
       */
      getSectionItemById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const populateSection = req.query.populate !== 'false';
        const includeSubSections = req.query.includeSubSections === 'true';
        
        const sectionItem = await clientSectionItemService.getSectionItemById(
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
          
          const sectionItems = await clientSectionItemService.getSectionItemsBySectionId(
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
        
        const sectionItems = await clientSectionItemService.getSectionItemsByWebSiteId(
            req.params.websiteId,
            activeOnly,
            limit,
            skip,
            includeSubSectionCount
        );
        
        sendSuccess(res, sectionItems, 'Section items retrieved successfully');
      });
        
}

export default new ClientSectionItemsController();