// src/gateway/apiGateway.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import logger from '../config/logger';

interface ServiceConfig {
  name: string;
  url: string;
  paths: string[];
  rateLimit: {
    windowMs: number;
    max: number;
  };
  requiresAuth: boolean;
}

class APIGateway {
  private app: express.Application;
  private services: ServiceConfig[] = [
    {
      name: 'auth-service',
      url: process.env.AUTH_SERVICE_URL || 'http://localhost:4001',
      paths: ['/api/v1/auth'],
      rateLimit: { windowMs: 15 * 60 * 1000, max: 10 },
      requiresAuth: false
    },
    {
      name: 'content-service', 
      url: process.env.CONTENT_SERVICE_URL || 'http://localhost:4002',
      paths: ['/api/v1/sections', '/api/v1/subsections', '/api/v1/content-elements', '/api/v1/translations'],
      rateLimit: { windowMs: 15 * 60 * 1000, max: 100 },
      requiresAuth: true
    },
    {
      name: 'website-service',
      url: process.env.WEBSITE_SERVICE_URL || 'http://localhost:4003', 
      paths: ['/api/v1/websites', '/api/v1/themes', '/api/v1/languages'],
      rateLimit: { windowMs: 15 * 60 * 1000, max: 50 },
      requiresAuth: true
    },
    {
      name: 'user-service',
      url: process.env.USER_SERVICE_URL || 'http://localhost:4004',
      paths: ['/api/v1/users'],
      rateLimit: { windowMs: 15 * 60 * 1000, max: 30 },
      requiresAuth: true
    }
  ];

  constructor() {
    this.app = express();
    this.setupSecurity();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupSecurity() {
    // Enhanced helmet configuration
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS with strict configuration
    this.app.use(cors({
      origin: (origin, callback) => {
        const allowedOrigins = env.corsAllowedOrigins.length > 0 
          ? env.corsAllowedOrigins 
          : ['http://localhost:3000', 'http://localhost:3001' ];
        
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Service-Signature'],
      exposedHeaders: ['X-Request-ID']
    }));

    // Global rate limiting
    this.app.use(rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: 900
      },
      standardHeaders: true,
      legacyHeaders: false,
    }));
  }

  private setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request ID middleware
    this.app.use(this.requestIdMiddleware);
    
    // Request logging
    this.app.use(this.requestLoggingMiddleware);
    
    // Security headers
    this.app.use(this.securityHeadersMiddleware);
    
    // Request signature verification
    this.app.use(this.requestSignatureMiddleware);
  }

  private requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const requestId = crypto.randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  };

  private requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    logger.info('Incoming request', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.headers['x-request-id']
    });

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info('Request completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        requestId: req.headers['x-request-id']
      });
    });

    next();
  };

  private securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    // Remove server information
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    
    next();
  };

  private requestSignatureMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Add request signature for inter-service communication
    const timestamp = Date.now().toString();
    const payload = JSON.stringify({
      method: req.method,
      url: req.url,
      timestamp,
      requestId: req.headers['x-request-id']
    });
    
    const signature = crypto
      .createHmac('sha256', env.jwt.secret)
      .update(payload)
      .digest('hex');
    
    req.headers['x-service-signature'] = signature;
    req.headers['x-timestamp'] = timestamp;
    
    next();
  };

  private authenticationMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: { type: 'AUTHENTICATION_REQUIRED' }
        });
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, env.jwt.secret) as any;
      
      req.headers['x-user-id'] = decoded.id;
      req.headers['x-user-role'] = decoded.role;
      req.headers['x-user-email'] = decoded.email;
      
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        error: { type: 'INVALID_TOKEN' }
      });
    }
  };

  private setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: this.services.map(service => ({
          name: service.name,
          status: 'unknown' // You can implement service health checks here
        }))
      });
    });

    // Setup service proxies
    this.services.forEach(service => {
      service.paths.forEach(path => {
        // Service-specific rate limiting
        const serviceRateLimit = rateLimit({
          windowMs: service.rateLimit.windowMs,
          max: service.rateLimit.max,
          message: {
            error: `Too many requests to ${service.name}`,
            service: service.name,
            retryAfter: Math.ceil(service.rateLimit.windowMs / 1000)
          },
          keyGenerator: (req) => {
            return `${req.ip}-${service.name}`;
          }
        });

        // Create proxy middleware
        const proxyMiddleware = createProxyMiddleware({
          target: service.url,
          changeOrigin: true,
          timeout: 30000,
          proxyTimeout: 30000,
          onProxyReq: (proxyReq, req) => {
            // Forward all custom headers
            Object.keys(req.headers).forEach(key => {
              if (key.startsWith('x-')) {
                proxyReq.setHeader(key, req.headers[key] as string);
              }
            });
            
            // Add service identification
            proxyReq.setHeader('X-Service-Origin', 'api-gateway');
            proxyReq.setHeader('X-Target-Service', service.name);
          },
          onError: (err, req, res) => {
            logger.error('Proxy error', {
              service: service.name,
              error: err.message,
              url: req.url,
              requestId: req.headers['x-request-id']
            });
            
            res.status(503).json({
              success: false,
              message: `Service ${service.name} temporarily unavailable`,
              error: { type: 'SERVICE_UNAVAILABLE' }
            });
          }
        });

        // Apply middleware chain
        const middlewares = [serviceRateLimit];
        
        if (service.requiresAuth) {
          middlewares.push(this.authenticationMiddleware);
        }
        
        middlewares.push(proxyMiddleware);
        
        this.app.use(path, ...middlewares);
      });
    });

    // Catch-all for undefined routes
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found',
        error: { type: 'ROUTE_NOT_FOUND' }
      });
    });
  }

  private setupErrorHandling() {
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Gateway error', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        requestId: req.headers['x-request-id']
      });

      res.status(500).json({
        success: false,
        message: 'Internal gateway error',
        error: { type: 'GATEWAY_ERROR' },
        requestId: req.headers['x-request-id']
      });
    });
  }

  public getApp(): express.Application {
    return this.app;
  }

  public start(port: number = 4000) {
    this.app.listen(port, () => {
      logger.info(`API Gateway running on port ${port}`);
      logger.info('Configured services:', this.services.map(s => s.name));
    });
  }
}

export default APIGateway;