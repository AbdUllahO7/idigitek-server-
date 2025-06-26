// src/services/website/website.service.app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDatabase } from '../../config/database';
import { env } from '../../config/env';
import logger from '../../config/logger';
import { securityStack, createAdaptiveRateLimit } from '../../middleware/enhancedSecurity.middleware';
import webSiteRoutes from '../../routes/webSite.routes';
import webSiteThemeRoutes from '../../routes/webSiteTheme.route';
import languageRoutes from '../../routes/language.routes';
import { authenticate } from '../../middleware/auth.middleware';
import { errorHandler, notFoundHandler } from '../../middleware/errorHandler.middleware';

class WebsiteService {
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

    this.app.use(createAdaptiveRateLimit({
      windowMs: 15 * 60 * 1000,
      max: 50
    }));
  }

  private setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    this.app.use((req, res, next) => {
      res.setHeader('X-Service-Name', 'website-service');
      next();
    });

    this.app.use((req, res, next) => {
      logger.info('Website service request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        requestId: req.headers['x-request-id']
      });
      next();
    });

    this.app.use('/api/v1', authenticate);
  }

  private setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({
        service: 'website-service',
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    });

    this.app.use('/api/v1/websites', webSiteRoutes);
    this.app.use('/api/v1/themes', webSiteThemeRoutes);
    this.app.use('/api/v1/languages', languageRoutes);
  }

  private setupErrorHandling() {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  public async start(port: number = 4003) {
    try {
      await connectDatabase();
      this.app.listen(port, () => {
        logger.info(`Website Service running on port ${port}`);
      });
    } catch (error) {
      logger.error('Failed to start Website Service:', error);
      process.exit(1);
    }
  }

  public getApp() {
    return this.app;
  }
}

export default WebsiteService;

if (require.main === module) {
  const websiteService = new WebsiteService();
  websiteService.start();
}
