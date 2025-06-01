import { Request, Response } from 'express';
import { LanguageService } from '../services/language.service';
import { sendSuccess } from '../utils/responseHandler';
import { AppError, asyncHandler } from '../middleware/errorHandler.middleware';

const languageService = new LanguageService();

export class LanguageController {
  // Create a new language
  createLanguage = asyncHandler(async (req: Request, res: Response) => {
    const { language, languageID, isActive, websiteId, subSections } = req.body;
    
    if (!language || !languageID) {
      throw AppError.badRequest('Language name and language ID are required');
    }
    
    if (!websiteId) {
      throw AppError.badRequest('Website ID is required');
    }
    
    const newLanguage = await languageService.createLanguage({
      language,
      languageID,
      isActive,
      websiteId,
      subSections
    });
    
    sendSuccess(res, newLanguage, 'Language created successfully', 201);
  });

  // Get all languages
  getAllLanguages = asyncHandler(async (req: Request, res: Response) => {
    const { isActive, websiteId } = req.query;
    const query: any = {};
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (websiteId) {
      query.websiteId = websiteId;
    }
    
    const languages = await languageService.getAllLanguages(query);
    
    sendSuccess(res, languages, 'Languages retrieved successfully');
  });

  // Get languages for a specific website
  getLanguagesByWebsite = asyncHandler(async (req: Request, res: Response) => {
    const websiteId = req.params.websiteId;
    
    const languages = await languageService.getLanguagesByWebsite(websiteId);
    
    sendSuccess(res, languages, `Languages for website ${websiteId} retrieved successfully`);
  });

  // Get language by ID
  getLanguageById = asyncHandler(async (req: Request, res: Response) => {
    const language = await languageService.getLanguageById(req.params.id);
    
    sendSuccess(res, language, 'Language retrieved successfully');
  });

  // Update language
  updateLanguage = asyncHandler(async (req: Request, res: Response) => {
    const language = await languageService.updateLanguage(req.params.id, req.body);
    
    sendSuccess(res, language, 'Language updated successfully');
  });

  // Delete language
  deleteLanguage = asyncHandler(async (req: Request, res: Response) => {
    const result = await languageService.deleteLanguage(req.params.id);
    
    sendSuccess(res, result, 'Language deleted successfully');
  });

  // Update only the isActive status of a language
  updateLanguageStatus = asyncHandler(async (req: Request, res: Response) => {
    const { isActive } = req.body;
    
    if (isActive === undefined || typeof isActive !== 'boolean') {
      throw AppError.badRequest('isActive must be a boolean value');
    }
    
    const language = await languageService.updateLanguageActiveStatus(req.params.id, isActive);
    
    sendSuccess(res, language, `Language status updated to ${isActive ? 'active' : 'inactive'} successfully`);
  });

  // Toggle language active status
  toggleLanguageStatus = asyncHandler(async (req: Request, res: Response) => {
    const language = await languageService.toggleLanguageStatus(req.params.id);
    
    sendSuccess(res, language, `Language status toggled to ${language.isActive ? 'active' : 'inactive'} successfully`);
  });

  // Batch update language statuses
  batchUpdateLanguageStatuses = asyncHandler(async (req: Request, res: Response) => {
    const { updates } = req.body;
    
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      throw AppError.badRequest('Valid updates array is required');
    }
    
    const result = await languageService.batchUpdateLanguageStatuses(updates);
    
    sendSuccess(res, result, result.message);
  });
}

export default new LanguageController();