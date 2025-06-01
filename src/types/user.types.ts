import { Document } from 'mongoose';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  SUPER_ADMIN = "superAdmin",
  OWNER = "owner",
  IDIGITEKADMIN = "idigitekAdmin"
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

export interface IUser extends Document {
  _id : string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  refreshToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  isEmailVerified: boolean;
  failedLoginAttempts: number;
  lastFailedLogin?: Date;
  lockUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  isAccountLocked(): boolean;
  generateRefreshToken(): string;
  generateVerificationToken(): string;
  generatePasswordResetToken(): string;
}

export interface IUserWithoutPassword {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    status: UserStatus;
    isEmailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ILoginUserRequest {
  email: string;
  password: string;
}

export interface IRegisterUserRequest {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}

export interface IAuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface IResetPasswordRequest {
    token: string;
    newPassword: string;
}

export interface IChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

export interface IDecodedToken {
    id: string;
    email: string;
    role: UserRole;
    iat: number;
    exp: number;
}