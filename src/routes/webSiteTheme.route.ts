import { Router } from 'express';
import { WebSiteThemeController } from '../controllers/WebSiteTheme.controller';

const router = Router();
const themeController = new WebSiteThemeController();

// Theme CRUD routes
router.post('/', themeController.createTheme);
router.get('/', themeController.getAllThemes);
router.get('/website/:websiteId', themeController.getThemesByWebSite);
router.get('/website/:websiteId/active', themeController.getActiveTheme);
router.get('/:themeId', themeController.getThemeById);
router.put('/:themeId', themeController.updateTheme);
router.patch('/:themeId/colors', themeController.updateThemeColors);
router.patch('/:themeId/fonts', themeController.updateThemeFonts);
router.patch('/website/:websiteId/active/:themeId', themeController.setActiveTheme);
router.post('/:themeId/clone', themeController.cloneTheme);
router.delete('/:themeId', themeController.deleteTheme);

export default router;