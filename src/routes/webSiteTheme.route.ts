// backend/routes/webSiteTheme.routes.ts

import { Router } from 'express';
import { WebSiteThemeController } from '../controllers/WebSiteTheme.controller';

const router = Router();
const themeController = new WebSiteThemeController();

router.post('/', themeController.createTheme);
router.get('/website/:websiteId', themeController.getThemesByWebSite);
router.get('/active/:websiteId', themeController.getActiveTheme);
router.get('/:themeId', themeController.getThemeById);
router.patch('/:themeId', themeController.updateTheme);
router.patch('/colors/:themeId', themeController.updateThemeColors);
router.patch('/fonts/:themeId', themeController.updateThemeFonts);
router.post('/set-active/:websiteId/:themeId', themeController.setActiveTheme);
router.delete('/:themeId', themeController.deleteTheme);
router.post('/clone/:themeId', themeController.cloneTheme);
router.get('/admin/all', themeController.getAllThemes);

export default router;