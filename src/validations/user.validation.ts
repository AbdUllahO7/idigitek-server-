import { body, param, query } from 'express-validator';
import { UserRole, UserStatus } from '../types/user.types';

/**
 * Validation rules for updating user profile
 */
/**
 * Validation rules for updating user profile (for current user)
 */
export const updateProfileValidator = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
    
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
    
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
    
  body('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
];

/**
 * Validation rules for updating any user (admin only)
 */
export const updateUserValidator = [
  param('id')
    .trim()
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('Invalid user ID format'),
    
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
    
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
    
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
    
  body('role')
    .optional()
    .trim()
    .isIn(Object.values(UserRole))
    .withMessage(`Role must be one of: ${Object.values(UserRole).join(', ')}`),
    
  body('status')
    .optional()
    .trim()
    .isIn(Object.values(UserStatus))
    .withMessage(`Status must be one of: ${Object.values(UserStatus).join(', ')}`),
    
  body('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
];


/**
 * Validation rules for updating user role (admin only)
 */
export const updateUserRoleValidator = [
  param('id')
    .trim()
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('Invalid user ID format'),
    
  body('role')
    .trim()
    .notEmpty()
    .withMessage('Role is required')
    .isIn(Object.values(UserRole))
    .withMessage(`Role must be one of: ${Object.values(UserRole).join(', ')}`),
];

/**
 * Validation rules for updating user status (admin only)
 */
export const updateUserStatusValidator = [
  param('id')
    .trim()
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('Invalid user ID format'),
    
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Status is required')
    .isIn(Object.values(UserStatus))
    .withMessage(`Status must be one of: ${Object.values(UserStatus).join(', ')}`),
];

/**
 * Validation rules for user search & filtering
 */
export const getUsersValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
    
  query('status')
    .optional()
    .isIn(Object.values(UserStatus))
    .withMessage(`Status must be one of: ${Object.values(UserStatus).join(', ')}`),
    
  query('role')
    .optional()
    .isIn(Object.values(UserRole))
    .withMessage(`Role must be one of: ${Object.values(UserRole).join(', ')}`),
    
  query('search')
    .optional()
    .trim()
    .escape(),
    
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'email', 'firstName', 'lastName', 'role', 'status'])
    .withMessage('Invalid sort field'),
    
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];

/**
 * Validation rules for getting a user by ID
 */
export const getUserByIdValidator = [
  param('id')
    .trim()
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('Invalid user ID format'),
];

export const createUserValidator = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
    
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
    
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
    
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
    
  body('role')
    .optional()
    .trim()
    .isIn(Object.values(UserRole))
    .withMessage(`Role must be one of: ${Object.values(UserRole).join(', ')}`),
    
  body('status')
    .optional()
    .trim()
    .isIn(Object.values(UserStatus))
    .withMessage(`Status must be one of: ${Object.values(UserStatus).join(', ')}`),
];