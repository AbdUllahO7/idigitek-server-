import mongoose from 'mongoose';
import { env } from './env';
import logger from './logger';

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
        logger.info(`MongoDB Query: ${collection}.${method}`, {
          query: JSON.stringify(query),
          doc: doc ? JSON.stringify(doc) : undefined
        });
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

