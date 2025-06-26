// src/services/content/content.service.app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDatabase } from '../../config/database';
import { env } from '../../config/env';
import logger from '../../config/logger';
import { securityStack, createAdaptiveRateLimit } from '../../middleware/enhancedSecurity.middleware';
import sectionRoutes from '../../routes/section.routes';
import subsectionRoutes from '../../routes/subSection.routes';
import contentElementRoutes from '../../routes/contentElement.routes';
import contentTranslationRoutes from '../../routes/contentTranslation.routes';
import { authenticate } from '../../middleware/auth.middleware';
import { errorHandler, notFoundHandler } from '../../middleware/errorHandler.middleware';

class ContentService {
  private app: express.Application;

  constructor() {
    this.app = express();
    this.setupSecurity();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupSecurity() {
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));

    this.app.use(cors({
      origin: env.corsAllowedOrigins.length > 0 ? env.corsAllowedOrigins : '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
    }));

    this.app.use(securityStack);

    // Content-specific rate limiting
    this.app.use(createAdaptiveRateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100 // 100 requests per 15 minutes for content operations
    }));
  }

  private setupMiddleware() {
    this.app.use(express.json({ limit: '50mb' })); // Larger limit for content with images
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    this.app.use((req, res, next) => {
      res.setHeader('X-Service-Name', 'content-service');
      next();
    });

    this.app.use((req, res, next) => {
      logger.info('Content service request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        requestId: req.headers['x-request-id']
      });
      next();
    });

    // Authentication for all content routes
    this.app.use('/api/v1', authenticate);
  }

  private setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({
        service: 'content-service',
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    });

    this.app.use('/api/v1/sections', sectionRoutes);
    this.app.use('/api/v1/subsections', subsectionRoutes);
    this.app.use('/api/v1/content-elements', contentElementRoutes);
    this.app.use('/api/v1/translations', contentTranslationRoutes);
  }

  private setupErrorHandling() {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  public async start(port: number = 4002) {
    try {
      await connectDatabase();
      this.app.listen(port, () => {
        logger.info(`Content Service running on port ${port}`);
      });
    } catch (error) {
      logger.error('Failed to start Content Service:', error);
      process.exit(1);
    }
  }

  public getApp() {
    return this.app;
  }
}

export default ContentService;

if (require.main === module) {
  const contentService = new ContentService();
  contentService.start();
}