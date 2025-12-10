import app from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';
import logger from './config/logger';

// Connect to database
let dbConnected = false;

const initializeApp = async () => {
  if (!dbConnected) {
    try {
      await connectDatabase();
      dbConnected = true;
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Database connection error:', error);
      throw error;
    }
  }
};

// For Vercel serverless environment  
if (process.env.VERCEL) {
  // Export for serverless
  module.exports = async (req: any, res: any) => {
    await initializeApp();
    return app(req, res);
  };
} else {
  // Traditional server for local development
  let server: any;

  const gracefulShutdown = (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    
    setTimeout(() => {
      logger.info('Server did not close in time. Forcefully shutting down.');
      process.exit(1);
    }, 10000);
    
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
  // testing pull 
  initializeApp()
    .then(() => {
      server = app.listen(env.port, "0.0.0.0", () => {
          logger.info(`Server running in ${env.nodeEnv} mode on port ${env.port}`);
          logger.info(`API available at http://0.0.0.0:${env.port}/api/${env.apiVersion}`);
        });

      process.on('unhandledRejection', (error) => {
        logger.error('Unhandled Rejection:', error);
        server.close(() => {
          process.exit(1);
        });
      });

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    })
    .catch((error) => {
      logger.error('Database connection error:', error);
      process.exit(1);
    });
}