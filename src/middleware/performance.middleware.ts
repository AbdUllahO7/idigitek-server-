import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

interface PerformanceMetrics {
  startTime: number;
  memoryBefore: NodeJS.MemoryUsage;
}

export const performanceMonitor = (req: Request, res: Response, next: NextFunction) => {
  const metrics: PerformanceMetrics = {
    startTime: Date.now(),
    memoryBefore: process.memoryUsage()
  };

  // Store metrics in request
  (req as any).performanceMetrics = metrics;

  // Hook into response finish event
  res.on('finish', () => {
    const duration = Date.now() - metrics.startTime;
    const memoryAfter = process.memoryUsage();
    const memoryDelta = {
      rss: memoryAfter.rss - metrics.memoryBefore.rss,
      heapUsed: memoryAfter.heapUsed - metrics.memoryBefore.heapUsed,
      heapTotal: memoryAfter.heapTotal - metrics.memoryBefore.heapTotal
    };

    // Log slow requests
    if (duration > 1000) { // Log requests taking more than 1 second
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        memoryDelta,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    }

    // Add performance headers
    res.set({
      'X-Response-Time': `${duration}ms`,
      'X-Memory-Usage': `${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`
    });
  });

  next();
};
