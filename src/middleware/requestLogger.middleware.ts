import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

/**
 * Log incoming requests
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Store request start time
  const startTime = Date.now();
  (req as any).startTime = startTime;
  
  // Log request details
  logger.info(`${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  
  // Log response after it's sent
  res.on('finish', () => {
    const processingTime = Date.now() - ((req as any).startTime || Date.now());
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel](`${req.method} ${req.originalUrl} ${res.statusCode}`, {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      processingTime: `${processingTime}ms`,
      contentLength: res.get('content-length') || 0,
    });
  });
  
  next();
};