import UserModel from '../models/user.model';
import { 
  ILoginUserRequest, 
  IRegisterUserRequest, 
  UserStatus 
} from '../types/user.types';
import { generateAuthTokens, verifyToken } from '../utils/jwt';
import crypto from 'crypto';
import logger from '../config/logger';
import { AppError } from '../middleware/errorHandler.middleware';

class AuthService {
  /**
   * Register a new user
   */
  register = async (userData: IRegisterUserRequest) => {
    // Check if user with this email already exists
    const existingUser = await UserModel.findOne({ email: userData.email });
    if (existingUser) {
      throw new AppError('Email already registered', 409);
    }

    // Create new user
    const user = new UserModel({
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      status: UserStatus.PENDING,
      isEmailVerified: false,
    });

    // Generate email verification token
    const verificationToken = user.generateVerificationToken();

    // Save user to database
    await user.save();

    // Generate auth tokens
    const tokens = generateAuthTokens(user);

    // Return user and tokens (except password)
    const userResponse = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    };

    return {
      user: userResponse,
      tokens,
      verificationToken, // In a real app, this would be sent via email, not returned directly
    };
  };

  /**
   * Login user
   */
  login = async (loginData: ILoginUserRequest) => {
    // Find user by email
    const user = await UserModel.findOne({ email: loginData.email });
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    // Check if account is locked
    if (user.isAccountLocked()) {
      throw new AppError('Account locked due to too many failed login attempts. Try again later.', 401);
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(loginData.password);
    if (!isPasswordValid) {
      // Increment failed login attempts
      user.failedLoginAttempts += 1;
      user.lastFailedLogin = new Date();

      // Lock account after 5 failed attempts
      if (user.failedLoginAttempts >= 5) {
        logger.warn(`Account locked: ${user.email} due to too many failed login attempts`);
      }

      await user.save();
      throw new AppError('Invalid email or password', 401);
    }

    // Check if account is active
    if (user.status === UserStatus.SUSPENDED) {
      throw new AppError('Account suspended. Please contact support.', 403);
    }
    
    if (user.status === UserStatus.INACTIVE) {
      throw new AppError('Account inactive. Please activate your account.', 403);
    }

    if (user.status === UserStatus.PENDING) {
      throw new AppError('Account PENDING. Please activate your account.', 403);
    }

    // Reset failed login attempts on successful login
    if (user.failedLoginAttempts > 0) {
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
    }

    // Generate auth tokens
    const tokens = generateAuthTokens(user);

    // Update user with new refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();

    // Return user and tokens (except password)
    const userResponse = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    };

    return {
      user: userResponse,
      tokens,
    };
  };

  /**
   * Logout user
   */
  logout = async (userId: string) => {
    // Find user and clear refresh token
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    user.refreshToken = undefined;
    await user.save();

    return { message: 'Logged out successfully' };
  };

  /**
   * Refresh access token
   */
  refreshToken = async (refreshToken: string) => {
    try {
      // Verify refresh token
      const decoded = verifyToken(refreshToken);

      // Find user with this refresh token
      const user = await UserModel.findOne({
        _id: decoded.id,
        refreshToken: refreshToken,
      });

      if (!user) {
        throw new AppError('Invalid refresh token', 401);
      }

      // Generate new tokens
      const tokens = generateAuthTokens(user);

      // Update user with new refresh token
      user.refreshToken = tokens.refreshToken;
      await user.save();

      return { tokens };
    } catch (error) {
      throw new AppError('Invalid refresh token', 401);
    }
  };

  /**
   * Request password reset
   */
  forgotPassword = async (email: string) => {
    // Find user by email
    const user = await UserModel.findOne({ email });
    if (!user) {
      // Don't reveal that email doesn't exist
      return { message: 'If your email is registered, you will receive a password reset link' };
    }

    // Generate password reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // In a real app, this token would be sent via email
    // For now, we'll just return it (only for development purposes)
    return {
      message: 'If your email is registered, you will receive a password reset link',
      resetToken, // Only for development/testing
    };
  };

  /**
   * Reset password with token
   */
  resetPassword = async (token: string, newPassword: string) => {
    // Hash the token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid token
    const user = await UserModel.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new AppError('Invalid or expired token', 400);
    }

    // Set new password
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    
    // Clear any account lockouts
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    
    await user.save();

    return { message: 'Password reset successfully' };
  };

  /**
   * Change user password
   */
  changePassword = async (
    userId: string,
    currentPassword: string,
    newPassword: string
  ) => {
    // Find user
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check if current password is correct
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Update password
    user.password = newPassword;
    await user.save();

    return { message: 'Password changed successfully' };
  };

  /**
   * Verify email with token
   */
  verifyEmail = async (token: string) => {
    // Hash the token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid token
    const user = await UserModel.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    // Update user status
    user.isEmailVerified = true;
    user.status = UserStatus.ACTIVE;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    await user.save();

    return { message: 'Email verified successfully' };
  };

  /**
   * Resend verification email
   */
  resendVerificationEmail = async (userId: string) => {
    // Find user
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check if email is already verified
    if (user.isEmailVerified) {
      throw new AppError('Email is already verified', 400);
    }

    // Generate new verification token
    const verificationToken = user.generateVerificationToken();
    await user.save();

    // In a real app, this token would be sent via email
    return {
      message: 'Verification email sent successfully',
      verificationToken, // Only for development/testing
    };
  };
}

export default new AuthService();