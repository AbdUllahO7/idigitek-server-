import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });
const isVercel = !!process.env.VERCEL;

export const env = {
  // Server settings
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '6000', 10),
  apiVersion: process.env.API_VERSION || 'v1',
  
  // MongoDB settings
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/secure-express-api',
    uriTest: process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/secure-express-api-test',
  },
  
  // JWT settings
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
    resetPasswordExpiration: process.env.JWT_RESET_PASSWORD_EXPIRATION || '10m',
    verifyEmailExpiration: process.env.JWT_VERIFY_EMAIL_EXPIRATION || '1d',
  },
  
  // Security settings
  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes in milliseconds (default)
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // Maximum 100 requests per window
  },
  
  // CORS settings
  corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(',') : [],
  
  // // Logging settings
  // logging: {
  //   level: process.env.LOG_LEVEL || 'info',
  //   filePath: process.env.LOG_FILE_PATH || (isVercel ? '/tmp/logs' : path.join(__dirname, '../../logs')),
  // },

  // Cloudinary settings
  cloudinaryUrl: process.env.CLOUDINARY_URL,
};



// if (env.logging.filePath && !fs.existsSync(env.logging.filePath)) {
//   try {
//     fs.mkdirSync(env.logging.filePath, { recursive: true });
//     console.log(`✅ Created log folder at ${env.logging.filePath}`);
//   } catch (error) {
//     console.warn(`❌ Failed to create log directory at ${env.logging.filePath}:`, error.message);
//   }
// }


// if (env.logging.filePath && !fs.existsSync(env.logging.filePath)) {
//   try {
//     fs.mkdirSync(env.logging.filePath, { recursive: true });
//   } catch (error) {
//     console.warn(`Failed to create log directory at ${env.logging.filePath}:`, error.message);
//   }
// }
// // Validate essential environment variables
// if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-secret-key-change-this-in-production') {
//   if (env.nodeEnv === 'production') {
//     throw new Error('JWT_SECRET environment variable is not set properly for production environment!');
//   } else {
//     console.warn('Warning: Using default JWT_SECRET for development. Do not use this in production!');
//   }
// }