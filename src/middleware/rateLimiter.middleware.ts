import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/**
 * Global rate limiter for all routes
 */
export const globalRateLimiter = rateLimit({
  windowMs: env.security.rateLimitWindowMs, // default: 15 minutes
  max: env.security.rateLimitMax, // default: 100 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
    timestamp: new Date().toISOString(),
  },
});

/**
 * Stricter rate limiter for auth routes (login, registration, etc.)
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    timestamp: new Date().toISOString(),
  },
});

/**
 * Very strict rate limiter for password reset attempts
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later.',
    timestamp: new Date().toISOString(),
  },
});