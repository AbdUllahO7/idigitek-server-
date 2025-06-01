import { Router } from 'express';
import subSectionController from '../controllers/subSection.controller';

const router = Router();

// Base routes
router.get('/', subSectionController.getAllSubSections);
router.post('/',  subSectionController.createSubSection);
router.get('/:id', subSectionController.getSubSectionById);
router.get('/:id/complete', subSectionController.getCompleteSubSectionById);
router.put('/:id',  subSectionController.updateSubSection);
router.delete('/:id',  subSectionController.deleteSubSection);

// Order management
router.put('/order',  subSectionController.updateSubsectionsOrder);

// Slug routes
router.get('/slug/:slug', subSectionController.getSubSectionBySlug);
router.get('/slug/:slug/complete', subSectionController.getCompleteSubSectionBySlug);

// WebSite routes
router.get('/website/:websiteId', subSectionController.getSubSectionsByWebSiteId);
router.get('/website/:websiteId/complete', subSectionController.getCompleteSubSectionsByWebSiteId);
router.get('/website/:websiteId/main', subSectionController.getMainSubSectionByWebSiteId);

// Section item routes
router.get('/sectionItem/:sectionItemId', subSectionController.getSubSectionsBySectionItemId);


// Section routes   
router.get('/section/:sectionId', subSectionController.getCompleteSubSectionsBySectionId);
router.get('/section/:sectionId/main', subSectionController.getMainSubSectionBySectionId);
router.get('/section/:sectionId/complete', subSectionController.getCompleteSubSectionsBySectionId); // New route

router.put('/order', subSectionController.updateSubsectionsOrder);
router.post('/sectionItem/:sectionItemId/reorder', subSectionController.reorderSubSectionsInSectionItem);

// Active status and order management
router.patch('/:id/toggle-active', subSectionController.toggleSubSectionActive);
router.patch('/:id/order', subSectionController.updateSubSectionOrder);
router.patch('/:id/move/:direction', subSectionController.moveSubSection);
router.patch('/:id/activate', subSectionController.activateDeactivateSubSection);
router.post('/sectionItems', subSectionController.getSubSectionsBySectionItemIds);


export default router;