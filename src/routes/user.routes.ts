import express from 'express';
import { validate } from '../middleware/validator.middleware';
import { authenticate, isAdmin, isOwnerOrAdmin } from '../middleware/auth.middleware';
import { 
  createUserValidator, 
  getUserByIdValidator, 
  getUsersValidator, 
  updateProfileValidator, 
  updateUserValidator,
  updateUserRoleValidator, 
  updateUserStatusValidator 
} from '../validations/user.validation';
import userController from '../controllers/user.controller';
import { UserRole } from 'src/types/user.types';

const router = express.Router();

// IMPORTANT: Order matters for route definitions
// More specific routes should come before general routes with params
router.get('/owners', authenticate, userController.getOwnerUsers);

/**
 * @route   GET /api/v1/users/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/me',
  authenticate,
  userController.getCurrentUser
);

/**
 * @route   PUT /api/v1/users/me
 * @desc    Update current user profile
 * @access  Private
 */
router.put(
  '/me',
  authenticate,
  validate(updateProfileValidator),
  userController.updateProfile
);

/**
 * @route   GET /api/v1/users
 * @desc    Get all users with pagination and filtering
 * @access  Admin
 */
router.get(
  '/',
  authenticate,
  isAdmin,
  validate(getUsersValidator),
  userController.getUsers
);

/**
 * @route   POST /api/v1/users
 * @desc    Create a new user
 * @access  Admin
 */
router.post(
  '/',
  authenticate,
  isAdmin,
  validate(createUserValidator),
  userController.createUser
);

/**
 * @route   PUT /api/v1/users/:id/role
 * @desc    Update user role
 * @access  Admin
 */
router.put(
  '/:id/role',
  authenticate,
  isAdmin,
  validate(updateUserRoleValidator),
  userController.updateUserRole
);

/**
 * @route   PUT /api/v1/users/:id/status
 * @desc    Update user status
 * @access  Admin
 */
router.put(
  '/:id/status',
  authenticate,
  isAdmin,
  validate(updateUserStatusValidator),
  userController.updateUserStatus
);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID
 * @access  Admin or Owner
 */
router.get(
  '/:id',
  authenticate,
  isOwnerOrAdmin,
  validate(getUserByIdValidator),
  userController.getUserById
);

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Update any user
 * @access  Admin
 */
router.put(
  '/:id',
  authenticate,
  isAdmin,
  validate(updateUserValidator),
  userController.updateUser
);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Delete user
 * @access  Admin
 */
router.delete(
  '/:id',
  authenticate,
  isAdmin,
  validate(getUserByIdValidator),
  userController.deleteUser
);


export default router;