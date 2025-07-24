// src/middleware/connectionMonitor.middleware.ts - نسخة مبسطة
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import logger from '../config/logger';

interface ConnectionMetrics {
  totalRequests: number;
  avgResponseTime: number;
  slowQueries: number;
  lastReset: Date;
}

class ConnectionMonitor {
  private metrics: ConnectionMetrics = {
    totalRequests: 0,
    avgResponseTime: 0,
    slowQueries: 0,
    lastReset: new Date()
  };
  
  private responseTimes: number[] = [];
  private readonly maxResponseTimes = 50; // Keep last 50 response times
  private readonly slowQueryThreshold = 1000; // 1 second
  
  /**
   * Simple monitoring middleware
   */
  public middleware = (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    this.metrics.totalRequests++;
    
    // Hook into response finish
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime);
      
      // Log slow queries
      if (responseTime > this.slowQueryThreshold) {
        logger.warn('Slow operation detected', {
          method: req.method,
          url: req.originalUrl,
          responseTime: `${responseTime}ms`,
          requestId: (req as any).requestId
        });
      }
    });
    
    next();
  };
  
  /**
   * Update connection metrics
   */
  private updateMetrics(responseTime: number): void {
    // Update response times
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > this.maxResponseTimes) {
      this.responseTimes = this.responseTimes.slice(-this.maxResponseTimes);
    }
    
    // Calculate average response time
    this.metrics.avgResponseTime = 
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
    
    // Count slow queries
    if (responseTime > this.slowQueryThreshold) {
      this.metrics.slowQueries++;
    }
  }
  
  /**
   * Get current metrics
   */
  public getMetrics(): ConnectionMetrics & {
    mongooseReadyState: number;
    connectionStatus: 'healthy' | 'warning' | 'critical';
  } {
    const readyState = mongoose.connection.readyState;
    let connectionStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (readyState !== 1) {
      connectionStatus = 'critical';
    } else if (this.metrics.avgResponseTime > 2000) {
      connectionStatus = 'warning';
    }
    
    return {
      ...this.metrics,
      mongooseReadyState: readyState,
      connectionStatus
    };
  }
  
  /**
   * Get detailed connection status
   */
  public async getDetailedStatus(): Promise<{
    database: {
      readyState: number;
      readyStateText: string;
      isConnected: boolean;
    };
    performance: {
      avgResponseTime: number;
      slowQueries: number;
      totalRequests: number;
    };
    recommendations: string[];
  }> {
    const readyStateMap: { [key: number]: string } = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    const metrics = this.getMetrics();
    const recommendations: string[] = [];
    
    // Generate recommendations based on current state
    if (metrics.connectionStatus === 'critical') {
      recommendations.push('Check database connection');
      recommendations.push('Review server logs for errors');
    } else if (metrics.connectionStatus === 'warning') {
      recommendations.push('Monitor response times closely');
      recommendations.push('Consider optimizing database queries');
    }
    
    if (metrics.avgResponseTime > 1000) {
      recommendations.push('Optimize slow database operations');
      recommendations.push('Consider adding database indexes');
    }
    
    if (metrics.slowQueries > 10) {
      recommendations.push('Review and optimize slow queries');
    }
    
    return {
      database: {
        readyState: mongoose.connection.readyState,
        readyStateText: readyStateMap[mongoose.connection.readyState] || 'unknown',
        isConnected: mongoose.connection.readyState === 1
      },
      performance: {
        avgResponseTime: Math.round(metrics.avgResponseTime),
        slowQueries: metrics.slowQueries,
        totalRequests: metrics.totalRequests
      },
      recommendations
    };
  }
  
  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      avgResponseTime: 0,
      slowQueries: 0,
      lastReset: new Date()
    };
    this.responseTimes = [];
    
    logger.info('Connection metrics reset');
  }
}

// Create singleton instance
const connectionMonitor = new ConnectionMonitor();

// Export middleware and monitor instance
export const connectionMonitorMiddleware = connectionMonitor.middleware;
export const getConnectionMetrics = () => connectionMonitor.getMetrics();
export const getDetailedConnectionStatus = () => connectionMonitor.getDetailedStatus();
export const resetConnectionMetrics = () => connectionMonitor.resetMetrics();