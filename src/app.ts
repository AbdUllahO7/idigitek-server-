import express, { Express ,Request, Response, NextFunction} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import xss from 'xss-clean';
import mongoSanitize from 'express-mongo-sanitize';

import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger.middleware';
import { connectionMonitorMiddleware, getConnectionMetrics, getDetailedConnectionStatus } from './middleware/connectionMonitor.middleware';

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import sectionRoutes from './routes/section.routes';
import subsectionRoutes from './routes/subSection.routes';
import { requestIdMiddleware } from './middleware/requestId.middlerware';
import languagesRoutes from './routes/language.routes';
import contentElementRoutes from './routes/contentElement.routes';
import contentTranslationRoutes from './routes/contentTranslation.routes';
import sectionsItemsRoutes from './routes/sectionItem.routes';
import webSiteRoutes from './routes/webSite.routes'
import webSiteThem from './routes/webSiteTheme.route'
import contactForm from './routes/contact.routes'

import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';
import logger from './config/logger';

const app: Express = express();
app.use((req: Request, res: Response, next: NextFunction) => {
  const host = req.get('Host');
  
  if (host === 'dijitaleser.com' || host === 'www.dijitaleser.com/') {
    return res.redirect(301, `https://idigitek.com${req.url}`);
  }
  
  next();
});
// Add unique identifier to each request - important for error tracking
app.use(requestIdMiddleware);

// Add connection monitoring middleware EARLY in the chain
app.use(connectionMonitorMiddleware);

// Set security HTTP headers
app.use(helmet());

app.use(express.json({ 
  limit: '10mb', 
  strict: false,
  type: ['application/json', 'text/plain'],
  verify: (req: any, res, buf) => {
    if (buf.length > 10 * 1024 * 1024) { // 10MB limit
      logger.warn(`Large request received: ${buf.length} bytes to ${req.path}`, {
        requestId: req.requestId,
        ip: req.ip
      });
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true,
  limit: '10mb',  // Reduced from 50mb
  parameterLimit: 10000 // Reduced from 100000
}));

// Sanitize request data (prevent NoSQL injection & XSS)
app.use(xss());
app.use(mongoSanitize());

// Compress responses
app.use(compression({
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Fallback to standard filter function
    return compression.filter(req, res);
  }
}));

// Enable CORS with optimized settings
app.use(
  cors({
    origin: env.nodeEnv === 'production' ? env.corsAllowedOrigins : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
    maxAge: 86400, // Cache preflight response for 24 hours
  })
);

// Request logging with connection info
if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

app.use(requestLogger);

// Enhanced error handling middleware for payload issues
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error.type === 'entity.too.large') {
    logger.warn('Request payload too large', {
      requestId: (req as any).requestId,
      contentLength: req.headers['content-length'],
      url: req.originalUrl,
      ip: req.ip
    });
    
    return res.status(413).json({
      success: false,
      message: 'Request payload too large. Please reduce the content size.',
      maxSize: '10MB', // Updated max size
      requestId: (req as any).requestId
    });
  }
  
  if (error.type === 'entity.parse.failed') {
    logger.warn('JSON parse failed', {
      requestId: (req as any).requestId,
      url: req.originalUrl,
      ip: req.ip
    });
    
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON format in request body.',
      requestId: (req as any).requestId
    });
  }

  next(error);
});

// API Routes
const apiVersion = env.apiVersion;
app.use(`/api/${apiVersion}/auth`, authRoutes);
app.use(`/api/${apiVersion}/users`, userRoutes);
app.use(`/api/${apiVersion}/sections`, sectionRoutes);
app.use(`/api/${apiVersion}/subsections`, subsectionRoutes);
app.use(`/api/${apiVersion}/languages`, languagesRoutes);
app.use(`/api/${apiVersion}/content-elements`, contentElementRoutes);
app.use(`/api/${apiVersion}/translations`, contentTranslationRoutes);
app.use(`/api/${apiVersion}/section-items`, sectionsItemsRoutes);
app.use(`/api/${apiVersion}/websites`, webSiteRoutes);
app.use(`/api/${apiVersion}/themes`, webSiteThem);
app.use(`/api/${apiVersion}/contactForm`, contactForm);

// Enhanced health check route with simple connection status
app.get('/health', async (req, res) => {
  try {
    const connectionStatus = await getDetailedConnectionStatus();
    const metrics = getConnectionMetrics();
    
    const healthStatus = {
      status: 'success',
      message: 'Server is healthy',
      timestamp: new Date().toISOString(),
      environment: env.nodeEnv,
      requestId: (req as any).requestId,
      database: {
        connected: connectionStatus.database.isConnected,
        status: connectionStatus.database.readyStateText
      },
      performance: {
        avgResponseTime: `${connectionStatus.performance.avgResponseTime}ms`,
        slowQueries: connectionStatus.performance.slowQueries,
        totalRequests: connectionStatus.performance.totalRequests
      }
    };
    
    // Set status code based on connection health
    const statusCode = metrics.connectionStatus === 'critical' ? 503 : 200;
    
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  }
});

// Simple connection metrics endpoint
app.get('/metrics/connections', async (req, res) => {
  try {
    const detailedStatus = await getDetailedConnectionStatus();
    res.json({
      success: true,
      data: detailedStatus,
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  } catch (error) {
    logger.error('Failed to get connection metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve connection metrics',
      requestId: (req as any).requestId
    });
  }
});

// Force garbage collection endpoint (development only)
if (env.nodeEnv === 'development') {
  app.post('/admin/gc', (req, res) => {
    if (global.gc) {
      global.gc();
      logger.info('Garbage collection forced');
      res.json({
        success: true,
        message: 'Garbage collection completed',
        memoryUsage: process.memoryUsage()
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Garbage collection not available. Start with --expose-gc flag.'
      });
    }
  });
}

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Starting graceful shutdown...');
  // The database disconnect and session cleanup will be handled by the database config
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Starting graceful shutdown...');
  // The database disconnect and session cleanup will be handled by the database config
});

// Memory monitoring (simplified for development)
if (env.nodeEnv === 'development') {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    
    if (memUsage.heapUsed > 200 * 1024 * 1024) { // 200MB
      logger.warn('High memory usage detected', {
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
      });
    }
  }, 120000); // Check every 2 minutes
}

export default app;