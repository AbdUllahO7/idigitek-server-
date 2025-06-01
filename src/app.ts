import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import xss from 'xss-clean';
import mongoSanitize from 'express-mongo-sanitize';

import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger.middleware';

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






import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';

const app: Express = express();

// Add unique identifier to each request - important for error tracking
app.use(requestIdMiddleware);

// Set security HTTP headers
app.use(helmet());

// Parse JSON request body
app.use(express.json({ limit: '10kb' }));

// Increase the payload size limit (example: 5MB)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));



// Sanitize request data (prevent NoSQL injection & XSS)
app.use(xss());
app.use(mongoSanitize());

// Compress responses
app.use(compression());

// Enable CORS
app.use(
  cors({
    origin: env.nodeEnv === 'production' ? env.corsAllowedOrigins : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Set global rate limit
// app.use(globalRateLimiter);

// Request logging
if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Before security middleware
app.use(express.json({ limit: '50mb' })); // Increased from 10kb
app.use(express.urlencoded({ 
  extended: true,
  limit: '50mb' // Increased from 10kb
}));

app.use(requestLogger);

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
app.use(`/api/${apiVersion}/websites`, webSiteRoutes);
app.use(`/api/${apiVersion}/themes`, webSiteThem);




// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
    requestId: (req as any).requestId,
  });
});

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;