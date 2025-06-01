import express from 'express';
import sectionRoutes from './section.routes';
import subsectionRoutes from './subSection.routes';

const router = express.Router();

// API routes
router.use('/api/sections', sectionRoutes);
router.use('/api/subsections', subsectionRoutes);

export default router;