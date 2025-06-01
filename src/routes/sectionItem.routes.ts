import express from 'express';
import SectionItemController from '../controllers/sectionItem.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// Base routes for section items
router.post('/', authenticate, SectionItemController.createSectionItem);
router.get('/', SectionItemController.getAllSectionItems);

// Route for updating order of multiple section items
router.put('/order', authenticate, SectionItemController.updateSectionItemsOrder);

// Get items by parent section
router.get('/section/:sectionId', SectionItemController.getSectionItemsBySectionId);
router.get('/website/:websiteId', SectionItemController.getSectionItemsByWebSiteId);

// Individual section item routes
router.get('/:id', SectionItemController.getSectionItemById);
router.put('/:id', authenticate, SectionItemController.updateSectionItem);
router.delete('/:id', authenticate, SectionItemController.deleteSectionItem);

export default router;