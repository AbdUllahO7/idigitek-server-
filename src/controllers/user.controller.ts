// src/controllers/user.controller.ts
import { Request, Response } from 'express';
import { sendSuccess, sendPaginatedSuccess } from '../utils/responseHandler';
import { UserRole, UserStatus } from '../types/user.types';
import userService from '../services/user.service';
import { AppError, asyncHandler } from '../middleware/errorHandler.middleware';

/**
 * User Controller
 * Handles all user-related requests
 */
class UserController {
    /**
     * Get current user profile
     */
  getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw AppError.badRequest('User ID is required');
    }
    
    const user = await userService.getCurrentUser(req.user.id);
    return sendSuccess(res, user, 'User profile retrieved successfully');
  });

  /**
 * Create a new user (superAdmin and Owner only)
 */
  createUser = asyncHandler(async (req: Request, res: Response) => {
      const userData = {
        email: req.body.email,
        password: req.body.password,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        role: req.body.role as UserRole | undefined,
        status: req.body.status as UserStatus | undefined,
      };
      
      // Check if trying to create an owner, but allow idigitekAdmin to bypass this check
      if (userData.role === UserRole.OWNER && req.user?.role !== UserRole.IDIGITEKADMIN) {
        // Check if an owner already exists
        const existingSuperAdmin = await userService.checkSuperOwnerExists();
        if (existingSuperAdmin) {
          throw AppError.validation('A Owner user already exists in the system');
        }
      }
      
      const newUser = await userService.createUser(userData);
      return sendSuccess(res, newUser, 'User created successfully', 201);
  });

  /**
   * Update any user (OWNER AND SUPER ADMIN )
   */
  updateUser = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.id;
    
    // First check if the target user is an owner
    const targetUser = await userService.getUserById(userId);
    if (targetUser.role === UserRole.OWNER) {
      // If target is an owner, check if current user is also an owner
      if (req.user?.role !== UserRole.OWNER) {
        throw AppError.validation('Only users with Owner role can modify Owner accounts');
      }
    }
    
    // Get all update fields from request body
    const updateData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      role: req.body.role as UserRole,
      status: req.body.status as UserStatus,
      password: req.body.password,
    };
    
    // Filter out undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    // Check if trying to update to owner
    if (updateData.role === UserRole.OWNER) {
      // Check if a owner already exists
      const existingSuperOwner = await userService.checkSuperOwnerExists();
      if (existingSuperOwner) {
        // Check if this user is already the OWNER (in which case, we'll allow the update)
        if (targetUser.role !== UserRole.OWNER) {
          throw AppError.validation('A OWNER user already exists in the system');
        }
      }
    }
    
    const updatedUser = await userService.updateUser(userId, updateData);
    return sendSuccess(res, updatedUser, 'User updated successfully');
  });
  
  /**
   * Update user profile
   */
  updateProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw AppError.badRequest('User ID is required');
    }
    
    // Get all update fields from request body
    const updateData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: req.body.password,
    };
    
    // Filter out undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    const updatedUser = await userService.updateProfile(req.user.id, updateData);
    return sendSuccess(res, updatedUser, 'Profile updated successfully');
  });
  
  /**
   * Get user by ID (admin only)
   */
  getUserById = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.getUserById(req.params.id);
    return sendSuccess(res, user, 'User retrieved successfully');
  });

  /**
   * Get all users with pagination and filtering (admin only)
   */
  getUsers = asyncHandler(async (req: Request, res: Response) => {
    const options = {
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      status: req.query.status as UserStatus | undefined,
      role: req.query.role as UserRole | undefined,
      search: req.query.search as string | undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
    };
    
    const result = await userService.getUsers(options);
    
    return sendPaginatedSuccess(
      res,
      result.users,
      result.pagination,
      'Users retrieved successfully'
    );
  });

  /**
 * Update user role (admin only)
 */
  updateUserRole = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.id;
    const newRole = req.body.role as UserRole;
    
    // First check if the target user is an owner
    const targetUser = await userService.getUserById(userId);
    if (targetUser.role === UserRole.OWNER) {
      // If target is an owner, check if current user is also an owner
      if (req.user?.role !== UserRole.OWNER) {
        throw AppError.validation('Only users with Owner role can modify Owner accounts');
      }
    }
    
    // Check if trying to update to superAdmin or owner
    if (newRole === UserRole.SUPER_ADMIN || newRole === UserRole.OWNER) {
      // Check if a superAdmin or owner already exists
      const existingSuperAdmin = await userService.checkSuperOwnerExists();
      if (existingSuperAdmin) {
        // Check if this user is already the superAdmin or owner (in which case, we'll allow the update)
        if (targetUser.role !== UserRole.SUPER_ADMIN && targetUser.role !== UserRole.OWNER) {
          throw AppError.validation('A SuperAdmin or Owner user already exists in the system');
        }
      }
    }
    
    const updatedUser = await userService.updateUserRole(userId, newRole);
    return sendSuccess(res, updatedUser, 'User role updated successfully');
  });

  /**
   * Update user status (admin only)
   */
  updateUserStatus = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.id;
    
    // First check if the target user is an owner
    const targetUser = await userService.getUserById(userId);
    if (targetUser.role === UserRole.OWNER) {
      // If target is an owner, check if current user is also an owner
      if (req.user?.role !== UserRole.OWNER) {
        throw AppError.validation('Only users with Owner role can modify Owner accounts');
      }
    }
    
    const updatedUser = await userService.updateUserStatus(
      userId,
      req.body.status as UserStatus
    );
    
    return sendSuccess(res, updatedUser, 'User status updated successfully');
  });

  /**
   * Delete user (admin only)
   */
  deleteUser = asyncHandler(async (req: Request, res: Response) => {
      const userId = req.params.id;
      
      // First check if the target user is an owner
      const targetUser = await userService.getUserById(userId);
      
      // Allow idigitekAdmin to delete any user including owners
      if (targetUser.role === UserRole.OWNER && req.user?.role !== UserRole.IDIGITEKADMIN) {
        throw AppError.validation('Owner accounts cannot be deleted except by idigitekAdmin');
      }
      
      // Check if this is the user trying to delete themselves
      if (req.user?.id === userId) {
        throw AppError.badRequest('You cannot delete your own account');
      }
      
      // Check for last user before deleting
      const userCount = await userService.getUserCount();
      if (userCount <= 1) {
        throw AppError.badRequest('Cannot delete the last user in the system');
      }
      
      const result = await userService.deleteUser(userId);
      return sendSuccess(res, result, 'User deleted successfully');
  });

  /**
   * Get all users with Owner role
   */
  getOwnerUsers = asyncHandler(async (req: Request, res: Response) => {
    const owners = await userService.getOwnerUsers();
    return sendSuccess(res, owners, 'Owner users retrieved successfully');
  });
  
}

export default new UserController();