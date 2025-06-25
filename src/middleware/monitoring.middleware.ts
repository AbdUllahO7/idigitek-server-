// src/middleware/monitoring.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import os from 'os';
import process from 'process';
import { env } from '../config/env';
import logger from '../config/logger';
import UserModel from '../models/user.model';

// ===============================
// AUDIT TRAIL MIDDLEWARE
// ===============================

interface AuditEvent {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  error?: string;
  requestId: string;
}

class AuditTrail {
  private static events: AuditEvent[] = [];
  private static maxEvents = 1000;

  static addEvent(event: AuditEvent): void {
    this.events.push(event);
    
    // Keep only recent events in memory
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents / 2);
    }

    // Log important events
    if (this.isImportantEvent(event)) {
      logger.warn('Important audit event', event);
    }

    // In production, you'd save this to database
    if (env.features.enableAuditTrail) {
      this.saveToDatabase(event);
    }
  }

  private static isImportantEvent(event: AuditEvent): boolean {
    const importantActions = [
      'DELETE',
      'user_role_change',
      'user_delete',
      'password_change',
      'login_failed',
      'account_locked'
    ];
    
    return importantActions.includes(event.action);
  }

  private static async saveToDatabase(event: AuditEvent): Promise<void> {
    try {
      // Here you would save to a dedicated audit log table/collection
      // For now, we'll add it to user's security log if user exists
      if (event.userId) {
        await UserModel.findByIdAndUpdate(
          event.userId,
          {
            $push: {
              securityLog: {
                event: event.action,
                timestamp: event.timestamp,
                ipAddress: event.ipAddress,
                userAgent: event.userAgent,
                details: {
                  resource: event.resource,
                  resourceId: event.resourceId,
                  success: event.success,
                  error: event.error
                }
              }
            }
          }
        );
      }
    } catch (error) {
      logger.error('Failed to save audit event to database', {
        error: error.message,
        event
      });
    }
  }

  static getRecentEvents(limit: number = 100): AuditEvent[] {
    return this.events.slice(-limit);
  }

  static getEventsByUser(userId: string, limit: number = 50): AuditEvent[] {
    return this.events
      .filter(event => event.userId === userId)
      .slice(-limit);
  }
}

export const auditTrailMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!env.features.enableAuditTrail) {
    return next();
  }

  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function(data) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Create audit event
    const event: AuditEvent = {
      userId: req.user?.id,
      action: `${req.method} ${req.route?.path || req.path}`,
      resource: req.originalUrl,
      resourceId: req.params.id,
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      timestamp: new Date(),
      success: res.statusCode < 400,
      requestId: (req as any).requestId || 'unknown'
    };

    if (res.statusCode >= 400) {
      event.error = `HTTP ${res.statusCode}`;
    }

    // Add request/response data for important operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      event.oldValue = (req as any).originalData;
      event.newValue = req.body;
    }

    AuditTrail.addEvent(event);

    return originalSend.call(this, data);
  };

  next();
};

// ===============================
// PERFORMANCE MONITORING
// ===============================

interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
  activeConnections: number;
  slowQueries: number;
  lastUpdated: Date;
}

class PerformanceMonitor {
  private static metrics: PerformanceMetrics = {
    requestCount: 0,
    averageResponseTime: 0,
    errorRate: 0,
    memoryUsage: process.memoryUsage(),
    cpuUsage: 0,
    activeConnections: 0,
    slowQueries: 0,
    lastUpdated: new Date()
  };

  private static responseTimes: number[] = [];
  private static errors: number = 0;
  private static lastCpuUsage = process.cpuUsage();

  static updateMetrics(responseTime: number, isError: boolean): void {
    this.metrics.requestCount++;
    
    // Track response times (keep last 1000)
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-500);
    }

    // Calculate average response time
    this.metrics.averageResponseTime = 
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;

    // Track errors
    if (isError) {
      this.errors++;
    }
    
    this.metrics.errorRate = (this.errors / this.metrics.requestCount) * 100;

    // Update system metrics every 100 requests
    if (this.metrics.requestCount % 100 === 0) {
      this.updateSystemMetrics();
    }

    this.metrics.lastUpdated = new Date();

    // Alert on performance issues
    this.checkPerformanceAlerts();
  }

  private static updateSystemMetrics(): void {
    // Memory usage
    this.metrics.memoryUsage = process.memoryUsage();

    // CPU usage
    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
    this.metrics.cpuUsage = (currentCpuUsage.user + currentCpuUsage.system) / 1000000; // Convert to seconds
    this.lastCpuUsage = process.cpuUsage();

    // Active connections (approximation)
    this.metrics.activeConnections = (process as any)._getActiveHandles().length;
  }

  private static checkPerformanceAlerts(): void {
    // Alert on high memory usage (>80% of available)
    const memoryUsageMB = this.metrics.memoryUsage.heapUsed / 1024 / 1024;
    const totalMemoryMB = os.totalmem() / 1024 / 1024;
    const memoryUsagePercent = (memoryUsageMB / totalMemoryMB) * 100;

    if (memoryUsagePercent > 80) {
      logger.warn('High memory usage detected', {
        usageMB: memoryUsageMB,
        totalMB: totalMemoryMB,
        percentage: memoryUsagePercent
      });
    }

    // Alert on high error rate (>5%)
    if (this.metrics.errorRate > 5) {
      logger.warn('High error rate detected', {
        errorRate: this.metrics.errorRate,
        totalRequests: this.metrics.requestCount,
        totalErrors: this.errors
      });
    }

    // Alert on slow average response time (>2 seconds)
    if (this.metrics.averageResponseTime > 2000) {
      logger.warn('Slow response time detected', {
        averageResponseTime: this.metrics.averageResponseTime,
        sampleSize: this.responseTimes.length
      });
    }
  }

  static getMetrics(): PerformanceMetrics {
    this.updateSystemMetrics();
    return { ...this.metrics };
  }

  static reset(): void {
    this.metrics = {
      requestCount: 0,
      averageResponseTime: 0,
      errorRate: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: 0,
      activeConnections: 0,
      slowQueries: 0,
      lastUpdated: new Date()
    };
    this.responseTimes = [];
    this.errors = 0;
  }
}

export const performanceMonitoringMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = performance.now();
  const originalSend = res.send;

  res.send = function(data) {
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    const isError = res.statusCode >= 400;

    PerformanceMonitor.updateMetrics(responseTime, isError);

    // Log slow requests
    if (responseTime > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.originalUrl,
        responseTime: Math.round(responseTime),
        statusCode: res.statusCode,
        userAgent: req.get('user-agent'),
        requestId: (req as any).requestId
      });
    }

    return originalSend.call(this, data);
  };

  next();
};

// ===============================
// SECURITY MONITORING
// ===============================

interface SecurityEvent {
  type: 'suspicious_activity' | 'failed_login' | 'rate_limit_exceeded' | 'malicious_request' | 'unauthorized_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string; // IP address
  details: any;
  timestamp: Date;
  blocked: boolean;
}

class SecurityMonitor {
  private static events: SecurityEvent[] = [];
  private static suspiciousIPs = new Map<string, number>();
  private static blockedIPs = new Set<string>();

  static addEvent(event: SecurityEvent): void {
    this.events.push(event);

    // Keep only recent events (last 1000)
    if (this.events.length > 1000) {
      this.events = this.events.slice(-500);
    }

    // Track suspicious IPs
    if (event.severity === 'high' || event.severity === 'critical') {
      const count = this.suspiciousIPs.get(event.source) || 0;
      this.suspiciousIPs.set(event.source, count + 1);

      // Auto-block IPs with multiple high-severity events
      if (count >= 5) {
        this.blockIP(event.source);
      }
    }

    // Log security events
    logger.warn('Security event detected', event);

    // Immediate alerts for critical events
    if (event.severity === 'critical') {
      this.sendSecurityAlert(event);
    }
  }

  private static blockIP(ip: string): void {
    this.blockedIPs.add(ip);
    logger.error('IP automatically blocked due to suspicious activity', {
      ip,
      eventCount: this.suspiciousIPs.get(ip)
    });

    // Auto-unblock after 24 hours
    setTimeout(() => {
      this.blockedIPs.delete(ip);
      logger.info('IP automatically unblocked', { ip });
    }, 24 * 60 * 60 * 1000);
  }

  private static sendSecurityAlert(event: SecurityEvent): void {
    // In production, send email/SMS/Slack notification
    logger.error('CRITICAL SECURITY EVENT', {
      type: event.type,
      source: event.source,
      details: event.details,
      timestamp: event.timestamp
    });
  }

  static isIPBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  static getRecentEvents(limit: number = 100): SecurityEvent[] {
    return this.events.slice(-limit);
  }

  static getSuspiciousIPs(): Map<string, number> {
    return new Map(this.suspiciousIPs);
  }

  static getBlockedIPs(): string[] {
    return Array.from(this.blockedIPs);
  }
}

export const securityMonitoringMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

  // Check if IP is blocked
  if (SecurityMonitor.isIPBlocked(clientIP)) {
    SecurityMonitor.addEvent({
      type: 'unauthorized_access',
      severity: 'high',
      source: clientIP,
      details: {
        url: req.originalUrl,
        method: req.method,
        userAgent: req.get('user-agent'),
        reason: 'blocked_ip'
      },
      timestamp: new Date(),
      blocked: true
    });

    return res.status(403).json({
      success: false,
      message: 'Access denied',
      error: { type: 'IP_BLOCKED' },
      timestamp: new Date().toISOString()
    });
  }

  // Monitor response for security events
  const originalSend = res.send;
  res.send = function(data) {
    // Log failed authentication attempts
    if (res.statusCode === 401 && req.originalUrl.includes('/auth/')) {
      SecurityMonitor.addEvent({
        type: 'failed_login',
        severity: 'medium',
        source: clientIP,
        details: {
          url: req.originalUrl,
          email: req.body?.email,
          userAgent: req.get('user-agent')
        },
        timestamp: new Date(),
        blocked: false
      });
    }

    // Log rate limit violations
    if (res.statusCode === 429) {
      SecurityMonitor.addEvent({
        type: 'rate_limit_exceeded',
        severity: 'medium',
        source: clientIP,
        details: {
          url: req.originalUrl,
          method: req.method,
          userAgent: req.get('user-agent')
        },
        timestamp: new Date(),
        blocked: true
      });
    }

    return originalSend.call(this, data);
  };

  next();
};

// ===============================
// HEALTH CHECK MIDDLEWARE
// ===============================

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
  environment: string;
  database: {
    status: 'connected' | 'disconnected' | 'error';
    responseTime?: number;
  };
  performance: PerformanceMetrics;
  security: {
    recentEvents: number;
    blockedIPs: number;
    suspiciousActivity: number;
  };
  dependencies: {
    [key: string]: 'healthy' | 'unhealthy';
  };
}

class HealthChecker {
  static async getStatus(): Promise<HealthStatus> {
    const performance = PerformanceMonitor.getMetrics();
    const securityEvents = SecurityMonitor.getRecentEvents(100);
    const blockedIPs = SecurityMonitor.getBlockedIPs();

    // Check database health
    const dbHealth = await this.checkDatabaseHealth();

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (dbHealth.status === 'error' || performance.errorRate > 10) {
      status = 'unhealthy';
    } else if (dbHealth.status === 'disconnected' || performance.errorRate > 5 || performance.averageResponseTime > 2000) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: env.nodeEnv,
      database: dbHealth,
      performance,
      security: {
        recentEvents: securityEvents.length,
        blockedIPs: blockedIPs.length,
        suspiciousActivity: securityEvents.filter(e => e.severity === 'high' || e.severity === 'critical').length
      },
      dependencies: await this.checkDependencies()
    };
  }

  private static async checkDatabaseHealth(): Promise<{ status: 'connected' | 'disconnected' | 'error'; responseTime?: number }> {
    try {
      const startTime = performance.now();
      
      // Import mongoose dynamically to avoid circular dependency
      const mongoose = require('mongoose');
      
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.db.admin().ping();
        const responseTime = performance.now() - startTime;
        return { status: 'connected', responseTime };
      } else {
        return { status: 'disconnected' };
      }
    } catch (error) {
      return { status: 'error' };
    }
  }

  private static async checkDependencies(): Promise<{ [key: string]: 'healthy' | 'unhealthy' }> {
    const dependencies: { [key: string]: 'healthy' | 'unhealthy' } = {};

    // Check external services (if any)
    // Example: Redis, external APIs, etc.
    
    return dependencies;
  }
}

export const healthCheckHandler = async (req: Request, res: Response) => {
  try {
    const health = await HealthChecker.getStatus();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date(),
      error: 'Health check failed',
      details: error.message
    });
  }
};

// ===============================
// METRICS ENDPOINT
// ===============================

export const metricsHandler = (req: Request, res: Response) => {
  // Require admin access for metrics
  if (!req.user || !['superAdmin', 'owner', 'idigitekAdmin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  const metrics = {
    performance: PerformanceMonitor.getMetrics(),
    security: {
      recentEvents: SecurityMonitor.getRecentEvents(50),
      suspiciousIPs: Array.from(SecurityMonitor.getSuspiciousIPs().entries()),
      blockedIPs: SecurityMonitor.getBlockedIPs()
    },
    audit: {
      recentEvents: AuditTrail.getRecentEvents(50)
    },
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: os.platform(),
      nodeVersion: process.version
    }
  };

  res.json(metrics);
};

// Export monitor classes for external access
export { PerformanceMonitor, SecurityMonitor, AuditTrail, HealthChecker };