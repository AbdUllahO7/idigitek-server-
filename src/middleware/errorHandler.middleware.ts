import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { sendError } from '../utils/responseHandler';
import { env } from '../config/env';

/**
  * Error types for classification
*/


export enum ErrorType {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  BAD_REQUEST = 'BAD_REQUEST',
  INTERNAL = 'INTERNAL',
  DATABASE = 'DATABASE',
  API = 'API',
  BUSINESS = 'BUSINESS',
  external = 'EXTERNAL',
}

/**
 * Enhanced custom error class
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  type: ErrorType;
  errorCode?: string;
  details?: any;

  constructor(
    message: string, 
    statusCode: number = 500, 
    isOperational: boolean = true,
    type: ErrorType = ErrorType.INTERNAL,
    errorCode?: string,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.type = type;
    this.errorCode = errorCode;
    this.details = details;
    
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Create a validation error
   */
  static validation(message: string = 'Validation error', details?: any): AppError {
    return new AppError(message, 400, true, ErrorType.VALIDATION, 'VALIDATION_ERROR', details);
  }

  /**
   * Create an authentication error
   */
  static authentication(message: string = 'Authentication failed', details?: any): AppError {
    return new AppError(message, 401, true, ErrorType.AUTHENTICATION, 'AUTHENTICATION_ERROR', details);
  }

  /**
   * Create an authorization error
   */
  static authorization(message: string = 'Unauthorized', details?: any): AppError {
    return new AppError(message, 403, true, ErrorType.AUTHORIZATION, 'AUTHORIZATION_ERROR', details);
  }

  /**
   * Create a not found error
   */
  static notFound(message: string = 'Resource not found', details?: any): AppError {
    return new AppError(message, 404, true, ErrorType.NOT_FOUND, 'RESOURCE_NOT_FOUND', details);
  }



  /**
   * Create a bad request error
   */
  static badRequest(message: string = 'Bad request', details?: any): AppError {
    return new AppError(message, 400, true, ErrorType.BAD_REQUEST, 'BAD_REQUEST', details);
  }

  /**
   * Create a database error
   */
  static database(message: string = 'Database error', details?: any): AppError {
    return new AppError(message, 500, false, ErrorType.DATABASE, 'DATABASE_ERROR', details);
  }
}

/**
 * Wrapper for async functions to handle errors
 */
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Enhanced error handler
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
) => {
  // Default error values
  let statusCode = 500;
  let message = 'Something went wrong';
  let errorType = ErrorType.INTERNAL;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let errorDetails = undefined;
  let isOperational = false;

  // Handle AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorType = err.type;
    errorCode = err.errorCode || errorCode;
    errorDetails = err.details;
    isOperational = err.isOperational;
    
    // Log operational errors
    if (err.isOperational) {
      logger.warn(`Operational error [${errorType}]: ${err.message}`, {
        error: err.stack,
        path: req.path,
        method: req.method,
        details: err.details,
        requestId: (req as any).requestId,
      });
    } else {
      // Critical error - log with higher priority
      logger.error(`Critical error [${errorType}]: ${err.message}`, {
        error: err.stack,
        path: req.path,
        method: req.method,
        details: err.details,
        requestId: (req as any).requestId,
      });
    }
  } else {
    // Handle MongoDB errors
    if (err.name === 'ValidationError') {
      statusCode = 400;
      message = 'Validation Error';
      errorType = ErrorType.VALIDATION;
      errorCode = 'MONGO_VALIDATION_ERROR';
      errorDetails = err.message;
      isOperational = true;
    } else if (err.name === 'CastError') {
      statusCode = 400;
      message = 'Invalid ID format';
      errorType = ErrorType.VALIDATION;
      errorCode = 'INVALID_ID_FORMAT';
      isOperational = true;
    } else if ((err as any).code === 11000) {
      statusCode = 409;
      message = 'Duplicate key error';
      errorType = ErrorType.DATABASE;
      errorCode = 'DUPLICATE_KEY_ERROR';
      isOperational = true;
      
      // Extract duplicate field info (for MongoDB duplicate key errors)
      const keyPattern = (err as any).keyPattern;
      if (keyPattern) {
        const field = Object.keys(keyPattern)[0];
        message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
        errorDetails = { field };
      }
    } else if (err.name === 'JsonWebTokenError') {
      statusCode = 401;
      message = 'Invalid token';
      errorType = ErrorType.AUTHENTICATION;
      errorCode = 'INVALID_TOKEN';
      isOperational = true;
    } else if (err.name === 'TokenExpiredError') {
      statusCode = 401;
      message = 'Token expired';
      errorType = ErrorType.AUTHENTICATION;
      errorCode = 'TOKEN_EXPIRED';
      isOperational = true;
    } else {
      // Unknown error - log it for debugging
      logger.error(`Unhandled error: ${err.message}`, {
        error: err.stack,
        path: req.path,
        method: req.method,
        requestId: (req as any).requestId,
      });
    }
  }

  // In development, include error stack in response
  const errorStack = env.nodeEnv === 'development' ? err.stack : undefined;

  // Send error response
  return sendError(
    res, 
    message, 
    statusCode, 
    {
      type: errorType,
      code: errorCode,
      details: errorDetails,
      stack: errorStack,
      isOperational
    }
  );
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  return sendError(
    res, 
    `Cannot ${req.method} ${req.originalUrl}`, 
    404, 
    {
      type: ErrorType.NOT_FOUND,
      code: 'ROUTE_NOT_FOUND'
    }
  );
};