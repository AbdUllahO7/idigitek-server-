import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import ContentElementController from '../controllers/ContentElement.controller';
import multer from 'multer';
import fs from 'fs';

const router = express.Router();

// Ensure /tmp/uploads directory exists
const uploadsDir = '/tmp/uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({ dest: uploadsDir });

// ContentElement routes

// Base routes for content elements
router.post('/', authenticate, ContentElementController.createContentElement);

// More specific routes must come before wildcard routes
router.put('/order', authenticate, ContentElementController.updateElementsOrder);
router.get('/subsection/:subsectionId', ContentElementController.getContentElementsBySubsection);

// Image upload route
router.post('/:id/image', authenticate, upload.single('image'), ContentElementController.uploadElementImage);

// Routes with the :id parameter should come last
router.get('/:id', ContentElementController.getContentElementById);
router.put('/:id', authenticate, ContentElementController.updateContentElement);
router.delete('/:id', authenticate, ContentElementController.deleteContentElement);

export default router;