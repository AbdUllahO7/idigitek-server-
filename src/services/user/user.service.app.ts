import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDatabase } from '../../config/database';
import { env } from '../../config/env';
import logger from '../../config/logger';
import { securityStack, createAdaptiveRateLimit } from '../../middleware/enhancedSecurity.middleware';
import userRoutes from '../../routes/user.routes';
import { authenticate } from '../../middleware/auth.middleware';
import { errorHandler, notFoundHandler } from '../../middleware/errorHandler.middleware';

class UserService {
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
      max: 30
    }));
  }

  private setupMiddleware() {
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    this.app.use((req, res, next) => {
      res.setHeader('X-Service-Name', 'user-service');
      next();
    });

    this.app.use((req, res, next) => {
      logger.info('User service request', {
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
        service: 'user-service',
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    });

    this.app.use('/api/v1/users', userRoutes);
  }

  private setupErrorHandling() {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  public async start(port: number = 4004) {
    try {
      await connectDatabase();
      this.app.listen(port, () => {
        logger.info(`User Service running on port ${port}`);
      });
    } catch (error) {
      logger.error('Failed to start User Service:', error);
      process.exit(1);
    }
  }

  public getApp() {
    return this.app;
  }
}

export default UserService;

if (require.main === module) {
  const userService = new UserService();
  userService.start();
}