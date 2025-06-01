import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { env } from './env';

const isVercel = !!process.env.VERCEL;
const isDevelopment = env.nodeEnv === 'development';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create transports array
const transports: winston.transport[] = [];

// Only use file logging in local development (not in Vercel)
if (isDevelopment && !isVercel) {
  const logDir = './logs';
  
  // Create logs directory if it doesn't exist (local development only)
  if (!fs.existsSync(logDir)) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch (error) {
      console.warn('Could not create log directory:', error);
    }
  }

  // Add file transports for local development
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
    })
  );
}

// Always add console transport (works in all environments)
transports.push(
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `${timestamp} ${level}: ${message} ${
          Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
        }`;
      })
    ),
  })
);

// Configure logger
const logger = winston.createLogger({
  level: env.logging.level,
  format: logFormat,
  defaultMeta: { service: 'secure-express-api' },
  transports
});

export default logger;