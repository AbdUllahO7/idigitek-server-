import mongoose from 'mongoose';
import { env } from './env';
import logger from './logger';

/**
 * Safe JSON stringify that handles circular references
 */
const safeJSONStringify = (obj: any, space?: number): string => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, val) => {
    if (val != null && typeof val === "object") {
      if (seen.has(val)) {
        return "[Circular Reference]";
      }
      seen.add(val);
    }
    return val;
  }, space);
};

/**
 * Sanitize MongoDB objects for logging by removing problematic circular references
 */
const sanitizeForLogging = (obj: any): any => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLogging);
  }

  // Create a new object without problematic properties
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip known problematic properties that cause circular references
    if (key === 'client' || 
        key === 'sessionPool' || 
        key === 's' || 
        key === 'session' ||
        key === '_session' ||
        key === 'topology' ||
        key === 'db' ||
        key === '_client') {
      sanitized[key] = '[MongoDB Internal Object]';
      continue;
    }

    // Recursively sanitize nested objects, but limit depth to prevent issues
    if (value && typeof value === 'object') {
      try {
        sanitized[key] = sanitizeForLogging(value);
      } catch (error) {
        sanitized[key] = '[Unable to serialize]';
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

export const connectDatabase = async (): Promise<void> => {
  try {
    const options: mongoose.ConnectOptions = {
      maxPoolSize: 100, // Increased connection pool
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxIdleTimeMS: 30000,
      
      // Performance optimizations
      readPreference: 'primary',
      writeConcern: { w: 'majority', j: true },
      readConcern: { level: 'majority' },
      
      // Connection optimization
      compressors: ['zlib'],
      zlibCompressionLevel: 6,
    };

    await mongoose.connect(env.mongodb.uriTest, options);
    
    // Enable query performance monitoring in development
    if (env.nodeEnv === 'development') {
      mongoose.set('debug', (collection, method, query, doc) => {
        try {
          // Safely log the query and document
          const logData: any = {
            collection,
            method,
            query: safeJSONStringify(sanitizeForLogging(query))
          };

          // Only add doc if it exists and try to sanitize it
          if (doc) {
            try {
              logData.doc = safeJSONStringify(sanitizeForLogging(doc));
            } catch (docError) {
              logData.doc = '[Unable to serialize document]';
              logger.warn('Failed to serialize MongoDB document for logging:', docError);
            }
          }

          logger.info(`MongoDB Query: ${collection}.${method}`, logData);
        } catch (error) {
          // Fallback logging without the problematic serialization
          logger.info(`MongoDB Query: ${collection}.${method}`, {
            query: '[Unable to serialize query]',
            doc: doc ? '[Document present but unable to serialize]' : undefined,
            error: error instanceof Error ? error.message : 'Unknown serialization error'
          });
        }
      });
    }

    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection error:', error);
    throw error;
  }
};

/**
 * Disconnect from MongoDB
 */
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error(`Error while closing MongoDB connection: ${error}`);
  }
};