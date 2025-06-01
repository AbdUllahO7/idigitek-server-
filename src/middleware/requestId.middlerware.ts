// src/middleware/requestId.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware to add a unique identifier to each request
 * This helps with request tracing across logs
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = uuidv4();
  req.requestId = requestId;
  
  // Add the request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  next();
};