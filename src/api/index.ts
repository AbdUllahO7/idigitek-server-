import app from "src/app";
import { connectDatabase } from "src/config/database";
import logger from "src/config/logger";

// Connect to database once
let dbConnected = false;

export default async function handler(req: any, res: any) {
  try {
    // Connect to database if not already connected
    if (!dbConnected) {
      await connectDatabase();
      dbConnected = true;
      logger.info('Database connected successfully');
    }

    // Handle the request with Express app
    return app(req, res);
  } catch (error) {
    logger.error('Serverless function error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}