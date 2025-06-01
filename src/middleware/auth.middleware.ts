// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { UserRole } from '../types/user.types';
import { AppError, ErrorType } from './errorHandler.middleware';

/**
 * Authenticate user middleware
 */
export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  try {
    // Extract token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.authentication('Authentication required');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw AppError.authentication('Authentication token is required');
    }

    // Verify token
    try {
      const decoded = verifyToken(token);

      // Set user info in the request
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      };

      next();
    } catch (error: any) {
      throw AppError.authentication('Invalid or expired token', { error: error.message });
    }
  } catch (error: any) {
    // Ensure error is properly typed or converted to AppError
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError(error.message || 'Authentication error', 401, true, ErrorType.AUTHENTICATION));
    }
  }
};

/**
 * Check if user has admin role
 */
export const isAdmin = (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw AppError.authentication('Authentication required');
    }
    if (req.user.role !== UserRole.SUPER_ADMIN && req.user.role !== UserRole.OWNER && req.user.role !== UserRole.IDIGITEKADMIN) {
      throw AppError.authorization('super Admin / Owner role required ', {
        requiredRole: UserRole.SUPER_ADMIN,
        userRole: req.user.role
      });
    }

    next();
  } catch (error: any) {
    // Ensure error is properly typed or converted to AppError
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError(error.message || 'Authorization error', 403, true, ErrorType.AUTHORIZATION));
    }
  }
};

/**
 * Check if user is accessing their own resource or is an admin
 */
export const isOwnerOrAdmin = (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw AppError.authentication('Authentication required');
    }

    // Allow if user is admin
    if (req.user.role === UserRole.SUPER_ADMIN ) {
      return next();
    }

    // Check if user is accessing their own resource
    const resourceId = req.params.id || req.body.userId;
    if (!resourceId) {
      throw AppError.badRequest('Resource ID is required');
    }
    
    if (resourceId === req.user.id) {
      return next();
    }

    throw AppError.authorization('You do not have permission to access this resource', {
      resourceId,
      userId: req.user.id
    });
  } catch (error: any) {
    // Ensure error is properly typed or converted to AppError
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError(error.message || 'Authorization error', 403, true, ErrorType.AUTHORIZATION));
    }
  }
};