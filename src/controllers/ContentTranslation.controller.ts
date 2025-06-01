import { Request, Response } from 'express';
import { sendSuccess } from '../utils/responseHandler';
import mongoose from 'mongoose';
import ContentTranslationService from '../services/ContentTranslation.service';
import { AppError, asyncHandler } from '../middleware/errorHandler.middleware';

class ContentTranslationController {
  /**
   * Create a new content translation
   * @route POST /api/translations
   */
  createTranslation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const translation = await ContentTranslationService.createTranslation(req.body);
    sendSuccess(res, translation, 'Translation created successfully', 201);
  });

  /**
   * Get translation by ID
   * @route GET /api/translations/:id
   */
  getTranslationById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const translation = await ContentTranslationService.getTranslationById(req.params.id);
    sendSuccess(res, translation, 'Translation retrieved successfully');
  });

  /**
   * Get all translations for a content element
   * @route GET /api/translations/element/:elementId
   */
  getTranslationsByContentElement = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeOnly = req.query.activeOnly !== 'false';
    
    const translations = await ContentTranslationService.getTranslationsByContentElement(
      req.params.elementId,
      activeOnly
    );
    
    sendSuccess(res, translations, 'Translations retrieved successfully');
  });

  /**
   * Get all translations for a language
   * @route GET /api/translations/language/:languageId
   */
  getTranslationsByLanguage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeOnly = req.query.activeOnly !== 'false';
    
    const translations = await ContentTranslationService.getTranslationsByLanguage(
      req.params.languageId,
      activeOnly
    );
    
    sendSuccess(res, translations, 'Translations retrieved successfully');
  });

  /**
   * Get specific translation by content element and language
   * @route GET /api/translations/element/:elementId/language/:languageId
   */
  getTranslation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const translation = await ContentTranslationService.getTranslation(
      req.params.elementId,
      req.params.languageId
    );
    
    if (!translation) {
      throw AppError.notFound('Translation not found');
    }
    
    sendSuccess(res, translation, 'Translation retrieved successfully');
  });

  /**
   * Update translation by ID
   * @route PUT /api/translations/:id
   */
  updateTranslation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const translation = await ContentTranslationService.updateTranslation(
      req.params.id,
      req.body
    );
    
    sendSuccess(res, translation, 'Translation updated successfully');
  });

  /**
   * Delete translation by ID
   * @route DELETE /api/translations/:id
   */
  deleteTranslation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const hardDelete = req.query.hardDelete === 'true';
    
    const result = await ContentTranslationService.deleteTranslation(
      req.params.id,
      hardDelete
    );
    
    sendSuccess(res, result, result.message);
  });

  /**
   * Bulk create or update translations
   * @route POST /api/translations/bulk
   */
  bulkUpsertTranslations = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { translations } = req.body;
    
    if (!translations || !Array.isArray(translations) || translations.length === 0) {
      throw AppError.badRequest('Valid translations array is required');
    }
    
    // Validate each translation in the array
    translations.forEach((translation, index) => {
      if (!translation.content) {
        throw AppError.validation(`Content is required for translation at index ${index}`);
      }
      
      if (!translation.id) {
        // For new translations, both contentElement and language are required
        if (!translation.contentElement || !mongoose.Types.ObjectId.isValid(translation.contentElement.toString())) {
          throw AppError.validation(`Valid contentElement is required for translation at index ${index}`);
        }
        
        if (!translation.language || !mongoose.Types.ObjectId.isValid(translation.language.toString())) {
          throw AppError.validation(`Valid language is required for translation at index ${index}`);
        }
      }
    });
    
    const result = await ContentTranslationService.bulkUpsertTranslations(translations);
    
    sendSuccess(res, result, `Processed ${translations.length} translations successfully`);
  });
}

export default new ContentTranslationController();