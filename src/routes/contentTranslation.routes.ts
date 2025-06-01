import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import ContentTranslationController from '../controllers/ContentTranslation.controller';

const router = express.Router();

/**
 * @route   POST /api/translations
 * @desc    Create a new translation
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  ContentTranslationController.createTranslation
);

/**
 * @route   POST /api/translations/bulk
 * @desc    Bulk create or update translations
 * @access  Private
 */
router.post(
  '/bulk',
  authenticate,
  ContentTranslationController.bulkUpsertTranslations
);

/**
 * @route   GET /api/translations/element/:elementId
 * @desc    Get all translations for a content element
 * @access  Public
 */
router.get(
  '/element/:elementId',
  ContentTranslationController.getTranslationsByContentElement
);

/**
 * @route   GET /api/translations/language/:languageId
 * @desc    Get all translations for a language
 * @access  Public
 */
router.get(
  '/language/:languageId',
  ContentTranslationController.getTranslationsByLanguage
);

/**
 * @route   GET /api/translations/element/:elementId/language/:languageId
 * @desc    Get specific translation by content element and language
 * @access  Public
 */
router.get(
  '/element/:elementId/language/:languageId',
  ContentTranslationController.getTranslation
);

/**
 * @route   GET /api/translations/:id
 * @desc    Get translation by ID
 * @access  Public
 */
router.get(
  '/:id',
  ContentTranslationController.getTranslationById
);

/**
 * @route   PUT /api/translations/:id
 * @desc    Update translation by ID
 * @access  Private
 */
router.put(
  '/:id',
  authenticate,
  ContentTranslationController.updateTranslation
);

/**
 * @route   DELETE /api/translations/:id
 * @desc    Delete translation by ID
 * @access  Private
 */
router.delete(
  '/:id',
  authenticate,
  ContentTranslationController.deleteTranslation
);

export default router;