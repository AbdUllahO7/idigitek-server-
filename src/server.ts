import app from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';
import logger from './config/logger';

// Graceful shutdown function
const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  
  setTimeout(() => {
    logger.info('Server did not close in time. Forcefully shutting down.');
    process.exit(1);
  }, 10000); // Force shutdown after 10 seconds if graceful shutdown fails
  
  // Close the server
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Initialize server variable
let server: any;

// Connect to MongoDB
connectDatabase()
  .then(() => {
    // Start the server after successful DB connection
    server = app.listen(env.port, () => {
      logger.info(`Server running in ${env.nodeEnv} mode on port ${env.port}`);
      logger.info(`API available at http://localhost:${env.port}/api/${env.apiVersion}`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (error) => {
      logger.error('Unhandled Rejection:', error);
      server.close(() => {
        process.exit(1);
      });
    });

    // Handle termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  })
  .catch((error) => {
    logger.error('Database connection error:', error);
    process.exit(1);
  });