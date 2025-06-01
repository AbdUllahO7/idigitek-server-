import { AppError } from '../middleware/errorHandler.middleware';
import UserModel from '../models/user.model';
import { IUserWithoutPassword, UserRole, UserStatus } from '../types/user.types';
import { createPaginationMeta } from '../utils/responseHandler';
import mongoose from 'mongoose';

class UserService {
  /**
   * Get the count of users in the system
   */
  getUserCount = async (): Promise<number> => {
    return await UserModel.countDocuments();
  };

  /**
   * Create a new user (admin only)
   */
  createUser = async (
    userData: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role?: UserRole;
      status?: UserStatus;
    }
  ): Promise<IUserWithoutPassword> => {
    // Check if email already exists
    const existingUser = await UserModel.findOne({ email: userData.email.toLowerCase() });
    if (existingUser) {
      throw AppError.badRequest('Email already in use', { email: userData.email });
    }

    // Validate data
    if (userData.firstName.length < 2 || userData.firstName.length > 50) {
      throw AppError.validation('First name must be between 2 and 50 characters');
    }
    
    if (userData.lastName.length < 2 || userData.lastName.length > 50) {
      throw AppError.validation('Last name must be between 2 and 50 characters');
    }

    if (userData.password.length < 8) {
      throw AppError.validation('Password must be at least 8 characters long');
    }

    // Create new user
    const user = new UserModel({
      email: userData.email.toLowerCase(),
      password: userData.password, // Password will be hashed in the model's pre-save hook
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role || UserRole.USER,
      status: userData.status || UserStatus.ACTIVE,
      isEmailVerified: false, // Default to false, can be changed by admins if needed
    });

    try {
      await user.save();
    } catch (error) {
      throw AppError.database('Failed to create user', { error: error.message });
    }

    // Return created user without password
    return {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  };

  /**
   * Get user by ID
   */
  getUserById = async (userId: string): Promise<IUserWithoutPassword> => {
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw AppError.validation('Invalid ID format');
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found', { userId });
    }

    // Return user without password
    return {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  };

  /**
   * Get current user profile
   */
  getCurrentUser = async (userId: string): Promise<IUserWithoutPassword> => {
    return this.getUserById(userId);
  };

  /**
   * Update any user (admin only)
   */
  updateUser = async (
    userId: string,
    updateData: {
      firstName?: string;
      lastName?: string;
      email?: string;
      role?: UserRole;
      status?: UserStatus;
      password?: string;
    }
  ): Promise<IUserWithoutPassword> => {
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw AppError.validation('Invalid ID format');
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found', { userId });
    }

    // Validate email if it's being updated
    if (updateData.email !== undefined) {
      // Check if email already exists (but ignore if it's the same user)
      const existingUser = await UserModel.findOne({ 
        email: updateData.email.toLowerCase(),
        _id: { $ne: userId } // Exclude current user
      });
      
      if (existingUser) {
        throw AppError.validation('Email already in use', { email: updateData.email });
      }
    }

    // Update fields if provided
    if (updateData.firstName !== undefined) {
      user.firstName = updateData.firstName;
    }
    
    if (updateData.lastName !== undefined) {
      user.lastName = updateData.lastName;
    }
    
    if (updateData.email !== undefined) {
      user.email = updateData.email.toLowerCase();
      
      // Reset email verification if email changes
      if (user.email !== updateData.email.toLowerCase()) {
        user.isEmailVerified = false;
      }
    }
    
    if (updateData.role !== undefined) {
      user.role = updateData.role;
    }
    
    if (updateData.status !== undefined) {
      user.status = updateData.status;
    }
    
    if (updateData.password !== undefined && updateData.password.trim() !== '') {
      user.password = updateData.password; // This will be hashed by the pre-save hook
    }

    try {
      await user.save();
    } catch (error) {
      throw AppError.database('Failed to update user', { error: error.message });
    }

    // Return updated user without password
    return {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  };


  /**
   * Update user profile (for the current user)
  */
  updateProfile = async (
    userId: string,
    updateData: {
      firstName?: string;
      lastName?: string;
      email?: string;
      password?: string;
    }
  ): Promise<IUserWithoutPassword> => {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found', { userId });
    }

    // Validate email if it's being updated
    if (updateData.email !== undefined) {
      // Check if email already exists (but ignore if it's the same user)
      const existingUser = await UserModel.findOne({ 
        email: updateData.email.toLowerCase(),
        _id: { $ne: userId } // Exclude current user
      });
      
      if (existingUser) {
        throw AppError.badRequest('Email already in use', { email: updateData.email });
      }
    }

    // Update fields if provided
    if (updateData.firstName !== undefined) {
      user.firstName = updateData.firstName;
    }
    
    if (updateData.lastName !== undefined) {
      user.lastName = updateData.lastName;
    }
    
    if (updateData.email !== undefined) {
      // Only update if the email is actually different
      if (user.email !== updateData.email.toLowerCase()) {
        user.email = updateData.email.toLowerCase();
        user.isEmailVerified = false;
      }
    }
    
    if (updateData.password !== undefined && updateData.password.trim() !== '') {
      user.password = updateData.password; // This will be hashed by the pre-save hook
    }

    try {
      await user.save();
    } catch (error) {
      throw AppError.database('Failed to update user profile', { error: error.message });
    }

    // Return updated user without password
    return {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  };
    /**
     * Get all users with pagination and filtering (admin only)
    */
  getUsers = async (options: {
    page?: number;
    limit?: number;
    status?: UserStatus;
    role?: UserRole;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = {};
    
    if (options.status) {
      filter.status = options.status;
    }
    
    if (options.role) {
      filter.role = options.role;
    }
    
    if (options.search) {
      filter.$or = [
        { email: { $regex: options.search, $options: 'i' } },
        { firstName: { $regex: options.search, $options: 'i' } },
        { lastName: { $regex: options.search, $options: 'i' } },
      ];
    }

    // Build sort options
    const sortOptions: any = {};
    if (options.sortBy) {
      // Validate allowed sort fields
      const allowedSortFields = ['createdAt', 'email', 'firstName', 'lastName', 'role', 'status'];
      if (!allowedSortFields.includes(options.sortBy)) {
        throw AppError.validation('Invalid sort field');
      }
      sortOptions[options.sortBy] = options.sortOrder === 'desc' ? -1 : 1;
    } else {
      sortOptions.createdAt = -1; // Default sort by creation date desc
    }

    try {
      // Count total matching documents
      const total = await UserModel.countDocuments(filter);

      // Get users with pagination
      const users = await UserModel.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .select('-password -refreshToken -emailVerificationToken -passwordResetToken');

      // Format users
      const formattedUsers = users.map(user => ({
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));

      // Create pagination metadata
      const pagination = createPaginationMeta(total, limit, page);

      return {
        users: formattedUsers,
        pagination,
      };
    } catch (error) {
      throw AppError.database('Failed to retrieve users', { error: error.message });
    }
  };

  /**
   * Update user role (admin only)
  */
  updateUserRole = async (userId: string, role: UserRole): Promise<IUserWithoutPassword> => {
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw AppError.validation('Invalid ID format');
    }

    // Validate role
    if (!Object.values(UserRole).includes(role)) {
      throw AppError.validation(`Role must be one of: ${Object.values(UserRole).join(', ')}`);
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found', { userId });
    }

    user.role = role;
    
    try {
      await user.save();
    } catch (error) {
      throw AppError.database('Failed to update user role', { error: error.message });
    }

    // Return updated user without password
    return {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  };

  /**
   * Update user status (admin only)
   */
  updateUserStatus = async (userId: string, status: UserStatus): Promise<IUserWithoutPassword> => {
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw AppError.validation('Invalid ID format');
    }

    // Validate status
    if (!Object.values(UserStatus).includes(status)) {
      throw AppError.validation(`Status must be one of: ${Object.values(UserStatus).join(', ')}`);
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found', { userId });
    }

    user.status = status;
    
    try {
      await user.save();
    } catch (error) {
      throw AppError.database('Failed to update user status', { error: error.message });
    }

    // Return updated user without password
    return {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  };

  /**
   * Delete user (admin only)
   */
  deleteUser = async (userId: string): Promise<{ message: string }> => {
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw AppError.validation('Invalid ID format');
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found', { userId });
    }

    try {
      await user.deleteOne();
      return { message: 'User deleted successfully' };
    } catch (error) {
      throw AppError.database('Failed to delete user', { error: error.message });
    }
  };

  /**
 * Check if a SuperAdmin user already exists in the system
 */
  checkSuperOwnerExists = async (): Promise<boolean> => {
      const count = await UserModel.countDocuments({  role : UserRole.OWNER });
      return count > 0;
    };
    // Add this to UserService
/**
 * Get all users with Owner role
 */
  getOwnerUsers = async (): Promise<IUserWithoutPassword[]> => {
    try {
      const owners = await UserModel.find({ role: UserRole.OWNER })
        .select('-password -refreshToken -emailVerificationToken -passwordResetToken');
      // Format users
      return owners.map(user => ({
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));
    } catch (error) {
      throw AppError.database('Failed to retrieve owner users', { error: error.message });
    }
  };
}



export default new UserService();