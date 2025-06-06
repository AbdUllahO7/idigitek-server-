// routes/section.routes.ts
import express from 'express';
import { SectionController } from '../controllers/section.controller';
import multer from 'multer';
import fs from 'fs';

const router = express.Router();
const sectionController = new SectionController();

// Ensure /tmp/uploads directory exists
const uploadsDir = '/tmp/uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({ dest: uploadsDir });

// Get all sections (public route)
router.get('/', sectionController.getAllSections);

// Get all sections with complete data (public route)
router.get('/all/complete', sectionController.getAllSectionsWithData);

// Get section by ID (public route)
router.get('/:id', sectionController.getSectionById);

// Get section with complete data (public route)
router.get('/:id/complete', sectionController.getSectionWithCompleteData);

// Get section with content by ID and language (public route)
router.get('/:id/content', sectionController.getSectionWithContent);

// Admin routes requiring authorization
// Create section
router.post(
  '/',
  sectionController.createSection
);

// Update section
router.put(
  '/:id',
  sectionController.updateSection
);

// Update section status
router.patch(
  '/:id/status',
  sectionController.updateSectionStatus
);

// Upload section image
router.post(
  '/:id/image',
  upload.single('image'),
  sectionController.uploadSectionImage
);

// Delete section
router.delete(
  '/:id',
  sectionController.deleteSection
);

router.get('/website/:websiteId', sectionController.getSectionsByWebsiteId);
router.get('/website/:websiteId/complete', sectionController.getSectionsWithDataByWebsiteId);

// Update section order
router.patch(
  '/order',
  sectionController.updateSectionOrder
);

export default router;