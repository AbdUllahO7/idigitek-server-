import { asyncHandler } from "../../middleware/errorHandler.middleware";
import { Request, Response } from 'express';
import { sendSuccess } from "../../utils/responseHandler";
import { AppError } from "../../middleware/errorHandler.middleware";
import clientSubSectionService from "../../services/clinet/clientSubSection.service";

class ClientSubSectionController {
  /**
   * Get complete subsections by section ID with all content elements and translations
   * @route GET /api/subsections/client/:id/complete
   */
  getCompleteSubSectionsBySectionId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!id) {
      throw AppError.validation('Section ID is required');
    }
    console.log("req.params.id", id);
    const activeOnly = req.query.activeOnly !== 'false';
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = parseInt(req.query.skip as string) || 0;

    const subsections = await clientSubSectionService.getCompleteSubSectionsBySectionId(
      id,
      activeOnly,
      limit,
      skip
    );

    sendSuccess(res, subsections, 'Complete subsections retrieved successfully');
  });

  /**
   * Get main subsection for a section
   * @route GET /api/subsections/client/Subsection/:sectionId/main
   */
  getMainSubSectionBySectionId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sectionId } = req.params;
    if (!sectionId) {
      throw AppError.validation('Section ID is required');
    }
    console.log("req.params.sectionId", sectionId);
    const mainSubsection = await clientSubSectionService.getMainSubSectionBySectionId(sectionId);

    if (!mainSubsection) {
      sendSuccess(res, null, 'No main subsection found for this section');
      return;
    }

    sendSuccess(res, mainSubsection, 'Main subsection retrieved successfully');
  });

  /**
   * Get subsections by section item ID
   * @route GET /api/subsections/client/SubSectionSectionItem/:sectionItemId
   */
  getSubSectionsBySectionItemId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sectionItemId } = req.params;
    if (!sectionItemId) {
      throw AppError.validation('Section Item ID is required');
    }
    console.log("req.params.sectionItemId", sectionItemId);
    const activeOnly = req.query.activeOnly !== 'false';
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = parseInt(req.query.skip as string) || 0;
    const includeContentCount = req.query.includeContentCount === 'true';

    const subsections = await clientSubSectionService.getSubSectionsBySectionItemId(
      sectionItemId,
      activeOnly,
      limit,
      skip,
      includeContentCount
    );

    sendSuccess(res, subsections, 'Subsections retrieved successfully');
  });

  /**
   * Get main subsection for a WebSite
   * @route GET /api/subsections/client/website/:websiteId/main
   */
  getMainSubSectionByWebSiteId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { websiteId } = req.params;
    if (!websiteId) {
      throw AppError.validation('Website ID is required');
    }
    console.log("req.params.websiteId", websiteId);
    const mainSubsection = await clientSubSectionService.getMainSubSectionByWebSiteId(websiteId);

    if (!mainSubsection) {
      sendSuccess(res, null, 'No main subsection found for this WebSite');
      return;
    }

    sendSuccess(res, mainSubsection, 'Main subsection retrieved successfully');
  });
}

export default new ClientSubSectionController();