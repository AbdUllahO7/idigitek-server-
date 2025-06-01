import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to validate the request body
 * @param schema - Joi schema for validation
 */
export const validateRequest = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!schema) return next();

    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.details.map((detail: any) => detail.message).join(', ')
      });
    }
    
    next();
  };
};

/**
 * Middleware to check if MongoDB ObjectId is valid
 */
export const validateObjectId = (req: Request, res: Response, next: NextFunction): Response | void => {
  const { id } = req.params;
  
  // Regular expression to check if string is a valid ObjectId
  const objectIdPattern = /^[0-9a-fA-F]{24}$/;
  
  if (!objectIdPattern.test(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  next();
};


/**
 * Middleware to handle async errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};