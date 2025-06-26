// src/middleware/enhancedSecurity.middleware.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { env } from '../config/env';
import logger from '../config/logger';

// Request signature verification for inter-service communication
export const verifyServiceSignature = (req: Request, res: Response, next: NextFunction) => {
  // Skip for requests from API Gateway or same service
  const serviceOrigin = req.headers['x-service-origin'];
  if (serviceOrigin === 'api-gateway' || process.env.NODE_ENV === 'development') {
    return next();
  }

  const signature = req.headers['x-service-signature'] as string;
  const timestamp = req.headers['x-timestamp'] as string;
  
  if (!signature || !timestamp) {
    return res.status(401).json({
      success: false,
      message: 'Service signature required',
      error: { type: 'MISSING_SERVICE_SIGNATURE' }
    });
  }

  // Verify timestamp (5 minute window)
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  
  if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
    return res.status(401).json({
      success: false,
      message: 'Request timestamp too old',
      error: { type: 'TIMESTAMP_EXPIRED' }
    });
  }

  // Verify signature
  const payload = JSON.stringify({
    method: req.method,
    url: req.url,
    timestamp,
    requestId: req.headers['x-request-id']
  });
  
  const expectedSignature = crypto
    .createHmac('sha256', env.jwt.secret)
    .update(payload)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return res.status(401).json({
      success: false,
      message: 'Invalid service signature',
      error: { type: 'INVALID_SERVICE_SIGNATURE' }
    });
  }

  next();
};

// Enhanced rate limiting with dynamic thresholds
export const createAdaptiveRateLimit = (options: {
  windowMs: number;
  max: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: (req) => {
      // Higher limits for authenticated users
      const userRole = req.headers['x-user-role'] as string;
      const baseLimit = options.max;
      
      switch (userRole) {
        case 'owner':
        case 'idigitekAdmin':
          return baseLimit * 3;
        case 'superAdmin':
          return baseLimit * 2;
        case 'admin':
          return baseLimit * 1.5;
        default:
          return baseLimit;
      }
    },
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    keyGenerator: (req) => {
      const userId = req.headers['x-user-id'];
      return userId ? `user-${userId}` : `ip-${req.ip}`;
    },
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userId: req.headers['x-user-id'],
        url: req.url,
        method: req.method,
        requestId: req.headers['x-request-id']
      });
      
      res.status(429).json({
        success: false,
        message: 'Too many requests',
        error: { 
          type: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(options.windowMs / 1000)
        },
        requestId: req.headers['x-request-id']
      });
    }
  });
};

// Progressive speed delay for suspicious behavior
export const createSpeedLimiter = () => {
  return slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // allow 50 requests per windowMs without delay
    delayMs: 500, // add 500ms of delay per request after delayAfter
    maxDelayMs: 20000, // max delay of 20 seconds
    keyGenerator: (req) => {
      const userId = req.headers['x-user-id'];
      return userId ? `user-${userId}` : `ip-${req.ip}`;
    }
  });
};

// Input sanitization and validation
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .trim();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

// SQL injection and NoSQL injection protection
export const protectAgainstInjection = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    // SQL injection patterns
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    // NoSQL injection patterns
    /\$where/i,
    /\$ne/i,
    /\$gt/i,
    /\$lt/i,
    /\$or/i,
    /\$and/i,
    /\$regex/i,
    // XSS patterns
    /((\%3C)|<)((\%2F)|\/)*[a-z0-9\%]+((\%3E)|>)/i,
    /((\%3C)|<)((\%69)|i|(\%49))((\%6D)|m|(\%4D))((\%67)|g|(\%47))[^\n]+((\%3E)|>)/i,
  ];

  const checkForInjection = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(obj));
    }
    
    if (Array.isArray(obj)) {
      return obj.some(checkForInjection);
    }
    
    if (obj && typeof obj === 'object') {
      return Object.values(obj).some(checkForInjection);
    }
    
    return false;
  };

  const requestString = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params
  });

  if (checkForInjection(requestString)) {
    logger.warn('Potential injection attempt detected', {
      ip: req.ip,
      userId: req.headers['x-user-id'],
      url: req.url,
      method: req.method,
      body: req.body,
      query: req.query,
      requestId: req.headers['x-request-id']
    });

    return res.status(400).json({
      success: false,
      message: 'Invalid request detected',
      error: { type: 'SUSPICIOUS_REQUEST' },
      requestId: req.headers['x-request-id']
    });
  }

  next();
};

// File upload security
export const secureFileUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file && !req.files) {
    return next();
  }

  const allowedMimeTypes = [
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv'
  ];

  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const validateFile = (file: any) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} is not allowed`);
    }

    if (file.size > maxFileSize) {
      throw new Error('File size exceeds maximum allowed size');
    }

    // Check for malicious file content
    const maliciousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js'];
    const fileName = file.originalname?.toLowerCase() || '';
    
    if (maliciousExtensions.some(ext => fileName.endsWith(ext))) {
      throw new Error('Potentially malicious file detected');
    }
  };

  try {
    if (req.file) {
      validateFile(req.file);
    }

    if (req.files) {
      if (Array.isArray(req.files)) {
        req.files.forEach(validateFile);
      } else {
        Object.values(req.files).flat().forEach(validateFile);
      }
    }

    next();
  } catch (error) {
    logger.warn('File upload security violation', {
      error: error.message,
      ip: req.ip,
      userId: req.headers['x-user-id'],
      requestId: req.headers['x-request-id']
    });

    return res.status(400).json({
      success: false,
      message: error.message,
      error: { type: 'FILE_SECURITY_VIOLATION' },
      requestId: req.headers['x-request-id']
    });
  }
};

// Request size limiting
export const limitRequestSize = (maxSize: string = '10mb') => {
  const maxSizeBytes = parseInt(maxSize.replace(/\D/g, '')) * 1024 * 1024;
  
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > maxSizeBytes) {
      logger.warn('Request size limit exceeded', {
        contentLength,
        maxSize: maxSizeBytes,
        ip: req.ip,
        userId: req.headers['x-user-id'],
        requestId: req.headers['x-request-id']
      });

      return res.status(413).json({
        success: false,
        message: 'Request entity too large',
        error: { 
          type: 'REQUEST_TOO_LARGE',
          maxSize: maxSize
        },
        requestId: req.headers['x-request-id']
      });
    }

    next();
  };
};

// IP-based security
export const ipSecurityCheck = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  // Check against known malicious IPs (you can integrate with threat intelligence)
  const maliciousIPs = process.env.BLOCKED_IPS?.split(',') || [];
  
  if (maliciousIPs.includes(clientIP)) {
    logger.warn('Blocked malicious IP attempt', {
      ip: clientIP,
      url: req.url,
      userAgent: req.get('User-Agent'),
      requestId: req.headers['x-request-id']
    });

    return res.status(403).json({
      success: false,
      message: 'Access denied',
      error: { type: 'IP_BLOCKED' },
      requestId: req.headers['x-request-id']
    });
  }

  next();
};

// Comprehensive security middleware stack
export const securityStack = [
  ipSecurityCheck,
  verifyServiceSignature,
  limitRequestSize('10mb'),
  sanitizeInput,
  protectAgainstInjection,
  secureFileUpload,
  createSpeedLimiter()
];

export default {
  verifyServiceSignature,
  createAdaptiveRateLimit,
  createSpeedLimiter,
  sanitizeInput,
  protectAgainstInjection,
  secureFileUpload,
  limitRequestSize,
  ipSecurityCheck,
  securityStack
};