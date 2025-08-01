// src/config/database.ts - نسخة صحيحة ومحدثة
import mongoose from 'mongoose';
import { env } from './env';
import logger from './logger';

// Connection pool configuration based on application size
const getPoolConfig = () => {
  const nodeEnv = env.nodeEnv;
  
  if (nodeEnv === 'production') {
    return {
      maxPoolSize: 20,  
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };
  } else {
    return {
      maxPoolSize: 20,  
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };
  }
};

// ✅ FIXED: Safe JSON stringify function that handles circular references
const safeStringify = (obj: any): string => {
  const seen = new WeakSet();
  
  try {
    return JSON.stringify(obj, (key, value) => {
      // Handle circular references
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      
      // Filter out MongoDB specific objects that cause circular references
      if (value && typeof value === 'object') {
        // Skip MongoDB client objects
        if (value.constructor && (
          value.constructor.name === 'MongoClient' ||
          value.constructor.name === 'ServerSessionPool' ||
          value.constructor.name === 'Topology' ||
          value.constructor.name === 'Server' ||
          value.constructor.name === 'ClientSession'
        )) {
          return '[MongoDB Internal Object]';
        }
        
        // Skip session objects and other problematic objects
        if (value.sessionPool || value.s || value._client) {
          return '[Session/Client Object]';
        }
      }
      
      return value;
    });
  } catch (error) {
    return '[Object too complex to stringify]';
  }
};

// Connection monitoring
const setupConnectionMonitoring = () => {
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected successfully');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (error) => {
    logger.error('MongoDB connection error:', error);
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  mongoose.connection.on('close', () => {
    logger.info('MongoDB connection closed');
  });
};

export const connectDatabase = async (): Promise<void> => {
  try {
    const poolConfig = getPoolConfig();
    
    const options: mongoose.ConnectOptions = {
      ...poolConfig,
      
      // Performance optimizations
      readPreference: 'primary',
      writeConcern: { w: 'majority', j: true },
      readConcern: { level: 'majority' },
      
      // Connection optimization
      compressors: ['zlib'],
      zlibCompressionLevel: 6,
      
      // Heartbeat and monitoring
      heartbeatFrequencyMS: 10000,
      serverSelectionTimeoutMS: 5000,
      
      // Auto-reconnection settings
      retryWrites: true,
      retryReads: true,
      
      // Family settings (IPv4)
      family: 4,
    };

    // Setup monitoring before connecting
    setupConnectionMonitoring();

    await mongoose.connect(env.mongodb.uriTest, options);
    
    // ✅ FIXED: Enable query performance monitoring in development only with safe JSON stringify
    if (env.nodeEnv === 'development') {
      mongoose.set('debug', (collection, method, query, doc) => {
        try {
          logger.info(`MongoDB Query: ${collection}.${method}`, {
            query: safeStringify(query),
            doc: doc ? safeStringify(doc) : undefined
          });
        } catch (error) {
          // Fallback logging without JSON if even safe stringify fails
          logger.info(`MongoDB Query: ${collection}.${method}`, {
            query: '[Query object - logging failed]',
            doc: doc ? '[Doc object - logging failed]' : undefined
          });
        }
      });
    }

    // Log connection pool status
    logger.info('Database connected successfully', {
      maxPoolSize: poolConfig.maxPoolSize,
      minPoolSize: poolConfig.minPoolSize,
      environment: env.nodeEnv,
      database: env.mongodb.uriTest.split('@')[1]?.split('/')[0] || 'unknown'
    });

  } catch (error) {
    logger.error('Database connection error:', error);
    throw error;
  }
};

// Enhanced disconnect function
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed gracefully');
  } catch (error) {
    logger.error(`Error while closing MongoDB connection: ${error}`);
  }
};

// Connection health check
export const checkDatabaseHealth = async (): Promise<{
  status: string;
  connections: number;
  readyState: number;
  dbName?: string;
}> => {
  try {
    const connection = mongoose.connection;
    
    if (connection.readyState !== 1) {
      return {
        status: 'disconnected',
        connections: 0,
        readyState: connection.readyState
      };
    }

    // Try to ping the database
    await connection.db?.admin().ping();
    
    return {
      status: 'connected',
      connections: 1, // Simplified - mongoose manages the pool internally
      readyState: connection.readyState,
      dbName: connection.db?.databaseName
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'error',
      connections: -1,
      readyState: mongoose.connection.readyState
    };
  }
};

// Graceful shutdown
export const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received. Closing MongoDB connection...`);
  
  try {
    await mongoose.connection.close(false);
    logger.info('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (error) {
    logger.error('Error during MongoDB graceful shutdown:', error);
    process.exit(1);
  }
};

// Setup graceful shutdown handlers only if not already set
let shutdownHandlersSet = false;

if (!shutdownHandlersSet) {
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon
  shutdownHandlersSet = true;
}