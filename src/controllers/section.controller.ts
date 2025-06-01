// controllers/SectionController.ts
import { Request, Response } from 'express';
import { sendSuccess } from '../utils/responseHandler';
import { SectionService } from '../services/section.service';
import { AppError, asyncHandler } from '../middleware/errorHandler.middleware';
/**
 * Section Controller
 * Handles all section-related requests
 */
export class SectionController {
  private sectionService: SectionService;

  constructor() {
    this.sectionService = new SectionService();
  }

  /**
   * Upload section image
   * @route POST /api/sections/:id/image
   */
  uploadSectionImage = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!id) {
      throw AppError.badRequest('Section ID is required');
    }
    
    if (!req.file) {
      throw AppError.badRequest('No image file provided');
    }
    
    // Get the uploaded image URL from the request file (provided by Cloudinary)
    const imageUrl = (req.file as any).path;
    
    // Update the section with the new image URL
    const section = await this.sectionService.updateSection(id, { image: imageUrl });
    
    if (!section) {
      throw AppError.notFound('Section not found');
    }
    
    return sendSuccess(res, section, 'Section image uploaded successfully');
  });

  /**
   * Create a new section
   */
  createSection = asyncHandler(async (req: Request, res: Response) => {
    const { name, description, image, isActive, order , WebSiteId , subName} = req.body;
    if (!name) {
      throw AppError.badRequest('name is required');
    }
    
    const section = await this.sectionService.createSection({
      name,
      subName,
      description,
      image,
      isActive,
      order,
      WebSiteId
    });
    
    return sendSuccess(res, section, 'Section created successfully', 201);
  });

  /**
   * Get all sections with optional filtering
   */
  getAllSections = asyncHandler(async (req: Request, res: Response) => {
    const { isActive } = req.query;
    const query: any = {};
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const sections = await this.sectionService.getAllSections(query);
    return res.status(200).json({
      success: true,
      count: sections.length,
      data: sections
    });
  });

  /**
   * Get section by ID
   */
  getSectionById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!id) {
      throw AppError.badRequest('Section ID is required');
    }
    
    const section = await this.sectionService.getSectionById(id);
    
    if (!section) {
      throw AppError.notFound('Section not found');
    }
    
    return sendSuccess(res, section, 'Section retrieved successfully');
  });

  /**
   * Update section
   */
  updateSection = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!id) {
      throw AppError.badRequest('Section ID is required');
    }
    
    const section = await this.sectionService.updateSection(id, req.body);
    
    if (!section) {
      throw AppError.notFound('Section not found');
    }
    
    return sendSuccess(res, section, 'Section updated successfully');
  });

  /**
   * Update section active status
   */
  updateSectionStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { isActive } = req.body;
    
    if (!id) {
      throw AppError.badRequest('Section ID is required');
    }
    
    if (isActive === undefined) {
      throw AppError.badRequest('isActive status is required');
    }
    
    if (typeof isActive !== 'boolean') {
      throw AppError.badRequest('isActive must be a boolean value');
    }
    
    const section = await this.sectionService.updateSectionStatus(id, isActive);
    
    if (!section) {
      throw AppError.notFound('Section not found');
    }
    
    return sendSuccess(res, section, `Section status ${isActive ? 'activated' : 'deactivated'} successfully`);
  });

  /**
   * Delete section
   */
  deleteSection = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!id) {
      throw AppError.badRequest('Section ID is required');
    }
    
    const result = await this.sectionService.deleteSection(id);
    
    return sendSuccess(res, result, 'Section deleted successfully');
  });

  /**
   * Get section with content by ID and language
   */
  getSectionWithContent = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { languageId } = req.query;
    
    if (!id) {
      throw AppError.badRequest('Section ID is required');
    }
    
    if (!languageId) {
      throw AppError.badRequest('Language ID is required');
    }
    
    const section = await this.sectionService.getSectionWithContent(id, languageId as string);
    
    if (!section) {
      throw AppError.notFound('Section not found');
    }
    
    return sendSuccess(res, section, 'Section with content retrieved successfully');
  });
  
  /**
   * Get section with all related data (section items and subsections)
   * @route GET /api/sections/:id/complete
   */
  getSectionWithCompleteData = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { includeInactive, languageId } = req.query;
    
    if (!id) {
      throw AppError.badRequest('Section ID is required');
    }
    
    // Convert string query param to boolean
    const includeInactiveItems = includeInactive === 'true';
    
    const section = await this.sectionService.getSectionWithCompleteData(
      id, 
      includeInactiveItems,
      languageId as string | undefined
    );
    
    if (!section) {
      throw AppError.notFound('Section not found');
    }
    
    return sendSuccess(res, section, 'Section with complete data retrieved successfully');
  });

  /**
   * Get all sections with their related data
   * @route GET /api/sections/all/complete
   */
  getAllSectionsWithData = asyncHandler(async (req: Request, res: Response) => {
    const { isActive, includeInactive, languageId } = req.query;
    const query: any = {};
    
    // Filter active/inactive sections
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    // Convert string query param to boolean
    const includeInactiveItems = includeInactive === 'true';
    
    const sections = await this.sectionService.getAllSectionsWithData(
      query, 
      includeInactiveItems,
      languageId as string | undefined
    );
    
    return res.status(200).json({
      success: true,
      count: sections.length,
      data: sections
    });
  });


  /**
   * Get all sections for a specific website
   * @route GET /api/sections/website/:websiteId
   */
  getSectionsByWebsiteId = asyncHandler(async (req: Request, res: Response) => {
    const { websiteId } = req.params;
    const { includeInactive } = req.query;
    
    if (!websiteId) {
      throw AppError.badRequest('Website ID is required');
    }
    
    // Convert string query param to boolean
    const showInactive = includeInactive === 'true';
    
    const sections = await this.sectionService.getSectionsByWebsiteId(websiteId, showInactive);
    
    return res.status(200).json({
      success: true,
      count: sections.length,
      data: sections
    });
  });

  /**
   * Get all sections with complete data for a specific website
   * @route GET /api/sections/website/:websiteId/complete
   */
  getSectionsWithDataByWebsiteId = asyncHandler(async (req: Request, res: Response) => {
    const { websiteId } = req.params;
    const { includeInactive, languageId } = req.query;
    
    if (!websiteId) {
      throw AppError.badRequest('Website ID is required');
    }
    
    // Convert string query param to boolean
    const showInactive = includeInactive === 'true';
    
    const sectionsWithData = await this.sectionService.getSectionsWithDataByWebsiteId(
      websiteId,
      showInactive,
      languageId as string | undefined
    );
    
    return res.status(200).json({
      success: true,
      count: sectionsWithData.length,
      data: sectionsWithData
    });
  });
  /**
 * Update section order
 * @route PATCH /api/sections/:id/order
 */
  updateSectionOrder = asyncHandler(async (req: Request, res: Response) => {
    const sections = req.body; // Expect array of { id, order, websiteId }

    if (!Array.isArray(sections) || sections.length === 0) {
      throw AppError.badRequest('Sections array is required');
    }

    const updatedSections = await this.sectionService.updateSectionOrder(
      sections.map(({ id, order, websiteId }) => ({
        sectionId: id,
        newOrder: order,
        websiteId,
      }))
    );

    return sendSuccess(res, updatedSections, 'Section order updated successfully');
  })
}