import express from 'express';
import { LanguageController } from '../controllers/language.controller';

const router = express.Router();
const languageController = new LanguageController();

// Language routes
router.post('/', languageController.createLanguage);
router.get('/', languageController.getAllLanguages);
router.get('/:id', languageController.getLanguageById);
router.put('/:id', languageController.updateLanguage);
router.delete('/:id', languageController.deleteLanguage);
router.patch('/:id/status', languageController.updateLanguageStatus);
router.patch('/:id/toggle', languageController.toggleLanguageStatus);
router.post('/batch-update', languageController.batchUpdateLanguageStatuses);

// Website-specific language routes
router.get('/website/:websiteId', languageController.getLanguagesByWebsite);






export default router;