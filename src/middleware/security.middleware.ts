// src/middleware/security.middleware.ts
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from '../config/env';
import { AppError } from './errorHandler.middleware';
import crypto from 'crypto';
import { UAParser } from 'ua-parser-js';
import logger from '../config/logger';

/**
 * Enhanced Rate Limiters
 */
export const globalRateLimiter = rateLimit({
  windowMs: env.security.rateLimitWindowMs,
  max: env.security.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use combination of IP and user agent for better tracking
    const userAgent = req.get('user-agent') || '';
    const ip = req.ip || req.connection.remoteAddress || '';
    return crypto.createHash('sha256').update(`${ip}-${userAgent}`).digest('hex');
  },
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded`, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      url: req.originalUrl,
      method: req.method,
      requestId: (req as any).requestId
    });
    
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.',
      error: {
        type: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.round(env.security.rateLimitWindowMs / 1000)
      },
      timestamp: new Date().toISOString(),
    });
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.security.authRateLimitMax,
  skipSuccessfulRequests: true, // Don't count successful requests
  keyGenerator: (req) => {
    const email = req.body?.email || '';
    const ip = req.ip || '';
    return crypto.createHash('sha256').update(`${ip}-${email}`).digest('hex');
  },
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded`, {
      ip: req.ip,
      email: req.body?.email,
      userAgent: req.get('user-agent'),
      requestId: (req as any).requestId
    });
    
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again later.',
      error: {
        type: 'AUTH_RATE_LIMIT_EXCEEDED',
        retryAfter: 900 // 15 minutes
      },
      timestamp: new Date().toISOString(),
    });
  },
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: env.security.passwordResetRateLimitMax,
  keyGenerator: (req) => {
    const email = req.body?.email || '';
    return crypto.createHash('sha256').update(email).digest('hex');
  },
  handler: (req, res) => {
    logger.warn(`Password reset rate limit exceeded`, {
      email: req.body?.email,
      ip: req.ip,
      requestId: (req as any).requestId
    });
    
    res.status(429).json({
      success: false,
      message: 'Too many password reset attempts, please try again later.',
      error: {
        type: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
        retryAfter: 3600 // 1 hour
      },
      timestamp: new Date().toISOString(),
    });
  },
});

/**
 * Enhanced Helmet Configuration
 */
export const enhancedHelmet = helmet({
  contentSecurityPolicy: env.features.enableCSP ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  } : false,
  
  hsts: env.features.enableHSTS ? {
    maxAge: env.headers.hstsMaxAge,
    includeSubDomains: true,
    preload: true
  } : false,
  
  frameguard: env.headers.frameDeny ? { action: 'deny' } : false,
  
  // Additional security headers
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false, // Can cause issues with some integrations
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  
  // Disable X-Powered-By header
  hidePoweredBy: true,
  
  // Additional headers
  dnsPrefetchControl: { allow: false },
  ieNoOpen: true,
  noSniff: true,
  xssFilter: true,
});

/**
 * API Key Validation Middleware
 */
export const apiKeyValidator = (req: Request, res: Response, next: NextFunction) => {
  if (!env.features.enableApiKey) {
    return next();
  }
  
  const apiKey = req.header('X-API-Key') || req.query.apiKey;
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key is required',
      error: { type: 'MISSING_API_KEY' },
      timestamp: new Date().toISOString(),
    });
  }
  
  if (apiKey !== env.features.apiKey) {
    logger.warn(`Invalid API key attempt`, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      apiKey: apiKey.substring(0, 8) + '***', // Log partial key for debugging
      requestId: (req as any).requestId
    });
    
    return res.status(401).json({
      success: false,
      message: 'Invalid API key',
      error: { type: 'INVALID_API_KEY' },
      timestamp: new Date().toISOString(),
    });
  }
  
  next();
};

/**
 * Request Size Limiter
 */
export const requestSizeLimiter = (req: Request, res: Response, next: NextFunction) => {
  const maxSize = parseInt(env.security.maxRequestSize.replace(/\D/g, '')) * 1024 * 1024; // Convert to bytes
  
  if (req.headers['content-length']) {
    const contentLength = parseInt(req.headers['content-length']);
    if (contentLength > maxSize) {
      logger.warn(`Request too large`, {
        contentLength,
        maxSize,
        ip: req.ip,
        url: req.originalUrl,
        requestId: (req as any).requestId
      });
      
      return res.status(413).json({
        success: false,
        message: 'Request entity too large',
        error: {
          type: 'REQUEST_TOO_LARGE',
          maxSize: env.security.maxRequestSize
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
  
  next();
};

/**
 * User Agent Analysis Middleware
 */
export const userAgentAnalysis = (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.get('user-agent') || '';
  
  if (!userAgent) {
    logger.warn(`Request without user agent`, {
      ip: req.ip,
      url: req.originalUrl,
      requestId: (req as any).requestId
    });
  }
  
  try {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    
    // Attach parsed user agent to request for later use
    (req as any).userAgentInfo = {
      browser: result.browser,
      os: result.os,
      device: result.device,
      isBot: /bot|crawl|spider/i.test(userAgent)
    };
    
    // Block known malicious user agents
    const maliciousPatterns = [
      /sqlmap/i,
      /nikto/i,
      /nessus/i,
      /openvas/i,
      /nmap/i,
      /masscan/i,
      /zap/i
    ];
    
    if (maliciousPatterns.some(pattern => pattern.test(userAgent))) {
      logger.warn(`Blocked malicious user agent`, {
        userAgent,
        ip: req.ip,
        url: req.originalUrl,
        requestId: (req as any).requestId
      });
      
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        error: { type: 'FORBIDDEN_USER_AGENT' },
        timestamp: new Date().toISOString(),
      });
    }
    
  } catch (error) {
    logger.error(`Error parsing user agent`, {
      error: error.message,
      userAgent,
      requestId: (req as any).requestId
    });
  }
  
  next();
};

/**
 * Suspicious Activity Detector
 */
export const suspiciousActivityDetector = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    // SQL Injection patterns
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    // XSS patterns
    /((\%3C)|<)((\%2F)|\/)*[a-z0-9\%]+((\%3E)|>)/i,
    /((\%3C)|<)((\%69)|i|(\%49))((\%6D)|m|(\%4D))((\%67)|g|(\%47))[^\n]+((\%3E)|>)/i,
    // Path traversal
    /\.\.\//i,
    /\.\.\\/i,
    // Command injection
    /;|\||`|&|\$\(|\$\{/i,
  ];
  
  const urlToCheck = req.originalUrl + JSON.stringify(req.body);
  
  if (suspiciousPatterns.some(pattern => pattern.test(urlToCheck))) {
    logger.warn(`Suspicious activity detected`, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      requestId: (req as any).requestId
    });
    
    return res.status(403).json({
      success: false,
      message: 'Suspicious activity detected',
      error: { type: 'SUSPICIOUS_ACTIVITY' },
      timestamp: new Date().toISOString(),
    });
  }
  
  next();
};

/**
 * IP Whitelist/Blacklist Middleware
 */
export const ipFilter = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip || req.connection.remoteAddress || '';
  
  // Example blacklist (you can load this from database or config)
  const blacklistedIPs = (process.env.BLACKLISTED_IPS || '').split(',').filter(Boolean);
  const whitelistedIPs = (process.env.WHITELISTED_IPS || '').split(',').filter(Boolean);
  
  // If IP is blacklisted, deny access
  if (blacklistedIPs.includes(clientIP)) {
    logger.warn(`Blocked blacklisted IP`, {
      ip: clientIP,
      url: req.originalUrl,
      requestId: (req as any).requestId
    });
    
    return res.status(403).json({
      success: false,
      message: 'Access denied',
      error: { type: 'IP_BLACKLISTED' },
      timestamp: new Date().toISOString(),
    });
  }
  
  // If whitelist exists and IP is not whitelisted, deny access
  if (whitelistedIPs.length > 0 && !whitelistedIPs.includes(clientIP)) {
    logger.warn(`Blocked non-whitelisted IP`, {
      ip: clientIP,
      url: req.originalUrl,
      requestId: (req as any).requestId
    });
    
    return res.status(403).json({
      success: false,
      message: 'Access denied',
      error: { type: 'IP_NOT_WHITELISTED' },
      timestamp: new Date().toISOString(),
    });
  }
  
  next();
};

/**
 * Request Timing Middleware for DoS protection
 */
interface RequestTiming {
  [key: string]: {
    count: number;
    firstRequest: number;
  };
}

const requestTimings: RequestTiming = {};

export const dosProtection = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip || req.connection.remoteAddress || '';
  const now = Date.now();
  const windowMs = 1000; // 1 second window
  const maxRequests = 20; // Max requests per second
  
  if (!requestTimings[clientIP]) {
    requestTimings[clientIP] = { count: 1, firstRequest: now };
  } else {
    const timing = requestTimings[clientIP];
    
    if (now - timing.firstRequest < windowMs) {
      timing.count++;
      
      if (timing.count > maxRequests) {
        logger.warn(`DoS protection triggered`, {
          ip: clientIP,
          requestCount: timing.count,
          timeWindow: windowMs,
          requestId: (req as any).requestId
        });
        
        return res.status(429).json({
          success: false,
          message: 'Too many requests per second',
          error: { type: 'DOS_PROTECTION_TRIGGERED' },
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      // Reset counter for new time window
      requestTimings[clientIP] = { count: 1, firstRequest: now };
    }
  }
  
  // Clean up old entries every minute
  if (Math.random() < 0.001) { // 0.1% chance to clean up
    const cutoff = now - 60000; // 1 minute ago
    Object.keys(requestTimings).forEach(ip => {
      if (requestTimings[ip].firstRequest < cutoff) {
        delete requestTimings[ip];
      }
    });
  }
  
  next();
};

/**
 * Security Headers Middleware
 */
export const additionalSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  // Add custom security headers
  res.setHeader('X-Request-ID', (req as any).requestId || 'unknown');
  res.setHeader('X-Security-Policy', 'strict');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Prevent caching of sensitive endpoints
  if (req.originalUrl.includes('/auth') || req.originalUrl.includes('/admin')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
};