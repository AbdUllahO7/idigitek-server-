// controllers/SectionController.ts
import { Request, Response } from 'express';
import { sendSuccess } from '../utils/responseHandler';
import { SectionService } from '../services/section.service';
import { AppError, asyncHandler } from '../middleware/errorHandler.middleware';

/**
 * Section Controller
 * Handles all section-related requests with multilingual support
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
    
    const imageUrl = (req.file as any).path;
    const section = await this.sectionService.updateSection(id, { image: imageUrl });
    
    if (!section) {
      throw AppError.notFound('Section not found');
    }
    
    return sendSuccess(res, section, 'Section image uploaded successfully');
  });

  /**
   * 🎯 UPDATED: Create a new section with multilingual support
   */
  createSection = asyncHandler(async (req: Request, res: Response) => {
    const { name, description, image, isActive, order, WebSiteId, subName } = req.body;
    
    // 🎯 NEW: Validate multilingual name structure
    if (!name || typeof name !== 'object') {
      throw AppError.badRequest('Multilingual name object is required');
    }
    
    if (!name.en || !name.ar || !name.tr) {
      throw AppError.badRequest('Section name is required in all languages (en, ar, tr)');
    }
    
    if (!subName) {
      throw AppError.badRequest('subName is required');
    }
    
    if (!WebSiteId) {
      throw AppError.badRequest('WebSiteId is required');
    }
    
    // 🎯 NEW: Prepare multilingual description
    const multilingualDescription = {
      en: description?.en || '',
      ar: description?.ar || '',
      tr: description?.tr || ''
    };
    
    const section = await this.sectionService.createSection({
      name: {
        en: name.en.trim(),
        ar: name.ar.trim(),
        tr: name.tr.trim()
      },
      subName,
      description: multilingualDescription,
      image,
      isActive,
      order,
      WebSiteId
    });
    
    return sendSuccess(res, section, 'Section created successfully', 201);
  });

  /**
   * 🎯 UPDATED: Get all sections with optional language support
   */
  getAllSections = asyncHandler(async (req: Request, res: Response) => {
    const { isActive, language } = req.query;
    const query: any = {};
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const sections = await this.sectionService.getAllSections(query);
    
    // 🎯 FIXED: Use proper typing for transformed data
    let responseData: any[];
    if (language && ['en', 'ar', 'tr'].includes(language as string)) {
      responseData = sections.map(section => ({
        ...section.toObject(),
        displayName: this.sectionService.getSectionNameByLanguage(section, language as 'en' | 'ar' | 'tr'),
        displayDescription: this.sectionService.getSectionDescriptionByLanguage(section, language as 'en' | 'ar' | 'tr')
      }));
    } else {
      responseData = sections.map(section => section.toObject());
    }
    
    return res.status(200).json({
      success: true,
      count: responseData.length,
      data: responseData
    });
  });

  /**
   * 🎯 UPDATED: Get section by ID with optional language support
   */
  getSectionById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { language } = req.query;
    
    if (!id) {
      throw AppError.badRequest('Section ID is required');
    }
    
    const section = await this.sectionService.getSectionById(id);
    
    if (!section) {
      throw AppError.notFound('Section not found');
    }
    
    // 🎯 NEW: Add display name and description based on language
    let responseData = section.toObject();
    if (language && ['en', 'ar', 'tr'].includes(language as string)) {
      responseData = {
        ...responseData,
        displayName: this.sectionService.getSectionNameByLanguage(section, language as 'en' | 'ar' | 'tr'),
        
        displayDescription: this.sectionService.getSectionDescriptionByLanguage(section, language as 'en' | 'ar' | 'tr')
      };
    }
    
    return sendSuccess(res, responseData, 'Section retrieved successfully');
  });

  /**
   * 🎯 UPDATED: Update section with multilingual support
   */
  updateSection = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    if (!id) {
      throw AppError.badRequest('Section ID is required');
    }
    
    // 🎯 NEW: Validate multilingual name if provided
    if (req.body.name) {
      if (typeof req.body.name !== 'object') {
        throw AppError.badRequest('Name must be a multilingual object');
      }
      
      if (!req.body.name.en || !req.body.name.ar || !req.body.name.tr) {
        throw AppError.badRequest('Section name is required in all languages (en, ar, tr)');
      }
      
      // Trim all names
      req.body.name = {
        en: req.body.name.en.trim(),
        ar: req.body.name.ar.trim(),
        tr: req.body.name.tr.trim()
      };
    }
    
    // 🎯 NEW: Handle multilingual description if provided
    if (req.body.description && typeof req.body.description === 'object') {
      req.body.description = {
        en: req.body.description.en || '',
        ar: req.body.description.ar || '',
        tr: req.body.description.tr || ''
      };
    }
    
    const section = await this.sectionService.updateSection(id, req.body);
    
    if (!section) {
      throw AppError.notFound('Section not found');
    }
    
    return sendSuccess(res, section, 'Section updated successfully');
  });

  /**
   * Update section active status (unchanged)
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
   * Delete section (unchanged)
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
   * Get section with content by ID and language (unchanged)
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
   * Get section with all related data (section items and subsections) (unchanged)
   */
  getSectionWithCompleteData = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { includeInactive, languageId } = req.query;
    
    if (!id) {
      throw AppError.badRequest('Section ID is required');
    }
    
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
   * 🎯 UPDATED: Get all sections with their related data and language support
   */
  getAllSectionsWithData = asyncHandler(async (req: Request, res: Response) => {
    const { isActive, includeInactive, languageId, language } = req.query;
    const query: any = {};
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const includeInactiveItems = includeInactive === 'true';
    
    const sections = await this.sectionService.getAllSectionsWithData(
      query, 
      includeInactiveItems,
      languageId as string | undefined
    );
    
    // 🎯 FIXED: Use proper typing for transformed data
    let responseData: any[];
    if (language && ['en', 'ar', 'tr'].includes(language as string)) {
      responseData = sections.map(section => ({
        ...section,
        displayName: this.sectionService.getSectionNameByLanguage(section, language as 'en' | 'ar' | 'tr'),
        displayDescription: this.sectionService.getSectionDescriptionByLanguage(section, language as 'en' | 'ar' | 'tr')
      }));
    } else {
      responseData = sections;
    }
    
    return res.status(200).json({
      success: true,
      count: responseData.length,
      data: responseData
    });
  });

  /**
   * 🎯 UPDATED: Get all sections for a specific website with language support
   */
  getSectionsByWebsiteId = asyncHandler(async (req: Request, res: Response) => {
    const { websiteId } = req.params;
    const { includeInactive, language } = req.query;
    
    if (!websiteId) {
      throw AppError.badRequest('Website ID is required');
    }
    
    const showInactive = includeInactive === 'true';
    const sections = await this.sectionService.getSectionsByWebsiteId(websiteId, showInactive);
    
    // 🎯 FIXED: Use proper typing for transformed data
    let responseData: any[];
    if (language && ['en', 'ar', 'tr'].includes(language as string)) {
      responseData = sections.map(section => ({
        ...section.toObject(),
        displayName: this.sectionService.getSectionNameByLanguage(section, language as 'en' | 'ar' | 'tr'),
        displayDescription: this.sectionService.getSectionDescriptionByLanguage(section, language as 'en' | 'ar' | 'tr')
      }));
    } else {
      responseData = sections.map(section => section.toObject());
    }
    
    return res.status(200).json({
      success: true,
      count: responseData.length,
      data: responseData
    });
  });

  /**
   * Get all sections with complete data for a specific website (unchanged)
   */
  getSectionsWithDataByWebsiteId = asyncHandler(async (req: Request, res: Response) => {
    const { websiteId } = req.params;
    const { includeInactive, languageId } = req.query;
    
    if (!websiteId) {
      throw AppError.badRequest('Website ID is required');
    }
    
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
   * Update section order (unchanged)
   */
  updateSectionOrder = asyncHandler(async (req: Request, res: Response) => {
    const sections = req.body;

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
  });
  /**
 * Get basic section information (id, name, subName) for lightweight operations
 * @route GET /api/sections/basic
 */
getBasicSectionInfo = asyncHandler(async (req: Request, res: Response) => {
  const { isActive, websiteId } = req.query;
  
  // Build query based on request parameters
  const query: any = {};
  
  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }
  
  const sections = await this.sectionService.getBasicSectionInfo(
    query, 
    websiteId as string | undefined
  );
  
  return res.status(200).json({
    success: true,
    count: sections.length,
    data: sections
  });
});

/**
 * Get basic section information for a specific website
 * @route GET /api/sections/basic/website/:websiteId
 */
getBasicSectionInfoByWebsite = asyncHandler(async (req: Request, res: Response) => {
  const { websiteId } = req.params;
  const { includeInactive } = req.query;
  
  if (!websiteId) {
    throw AppError.badRequest('Website ID is required');
  }
  
  const showInactive = includeInactive === 'true';
  
  const sections = await this.sectionService.getBasicSectionInfoByWebsite(
    websiteId, 
    showInactive
  );
  
  return res.status(200).json({
    success: true,
    count: sections.length,
    data: sections
  });
});
}