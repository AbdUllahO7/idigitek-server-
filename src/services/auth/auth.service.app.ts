import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDatabase } from '../../config/database';
import { env } from '../../config/env';
import logger from '../../config/logger';
import { securityStack, createAdaptiveRateLimit } from '../../middleware/enhancedSecurity.middleware';
import authRoutes from '../../routes/auth.routes';
import { errorHandler, notFoundHandler } from '../../middleware/errorHandler.middleware';

class AuthService {
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
      contentSecurityPolicy: false, // Allow for API usage
      crossOriginEmbedderPolicy: false
    }));

    this.app.use(cors({
      origin: env.corsAllowedOrigins.length > 0 ? env.corsAllowedOrigins : '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
    }));

    // Apply security stack
    this.app.use(securityStack);

    // Auth-specific rate limiting
    this.app.use('/api/v1/auth/login', createAdaptiveRateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5, // 5 login attempts per 15 minutes
      skipSuccessfulRequests: true
    }));

    this.app.use('/api/v1/auth/register', createAdaptiveRateLimit({
      windowMs: 60 * 60 * 1000,
      max: 3 // 3 registration attempts per hour
    }));
  }

  private setupMiddleware() {
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Service identification
    this.app.use((req, res, next) => {
      res.setHeader('X-Service-Name', 'auth-service');
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      logger.info('Auth service request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        requestId: req.headers['x-request-id']
      });
      next();
    });
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        service: 'auth-service',
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    });

    // Auth routes
    this.app.use('/api/v1/auth', authRoutes);
  }

  private setupErrorHandling() {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  public async start(port: number = 4001) {
    try {
      await connectDatabase();
      this.app.listen(port, () => {
        logger.info(`Auth Service running on port ${port}`);
      });
    } catch (error) {
      logger.error('Failed to start Auth Service:', error);
      process.exit(1);
    }
  }

  public getApp() {
    return this.app;
  }
}

// Export for testing or external usage
export default AuthService;

// Start service if run directly
if (require.main === module) {
  const authService = new AuthService();
  authService.start();
}