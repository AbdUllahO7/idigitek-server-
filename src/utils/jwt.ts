import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { IUser, IDecodedToken } from '../types/user.types';

// Helper function to sign JWT tokens with proper typing
const signToken = (
  payload: Record<string, any>,
  secret: string,
  options: SignOptions
): string => {
  // Using Buffer.from to ensure the secret is properly typed
  const secretBuffer = Buffer.from(secret, 'utf8');
  return jwt.sign(payload, secretBuffer, options);
};

/**
 * Generate JWT access token
 */
export const generateAccessToken = (user: IUser): string => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
  };
  
  return signToken(
    payload,
    env.jwt.secret,
    {}
    // { expiresIn: env.jwt.accessExpiration as jwt.SignOptions['expiresIn'] }
  );
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): IDecodedToken => {
  try {
    // Using Buffer.from to ensure the secret is properly typed
    const secretBuffer = Buffer.from(env.jwt.secret, 'utf8');
    return jwt.verify(token, secretBuffer) as IDecodedToken;
  } catch (error) {
    throw new Error('Invalid token');
  }
};

/**
 * Generate tokens (access + refresh)
 */
export const generateAuthTokens = (user: IUser) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = user.generateRefreshToken();
  
  return {
    accessToken,
    refreshToken,
  };
};

/**
 * Generate token for account verification
 */
export const generateVerificationToken = (user: IUser): string => {
  const payload = {
    id: user._id,
    email: user.email,
  };
  
  return signToken(
    payload,
    env.jwt.secret,
    { expiresIn: env.jwt.verifyEmailExpiration as jwt.SignOptions['expiresIn'] }
  );
};

/**
 * Generate token for password reset
 */
export const generateResetToken = (user: IUser): string => {
  const payload = {
    id: user._id,
    email: user.email,
  };
  
  return signToken(
    payload,
    env.jwt.secret,
    { expiresIn: env.jwt.resetPasswordExpiration as jwt.SignOptions['expiresIn'] }
  );
};