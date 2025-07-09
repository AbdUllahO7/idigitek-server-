// 1. Redis Cache Service
// src/services/cache.service.ts
import Redis from 'ioredis';
import { env } from '../config/env';
import logger from '../config/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  compress?: boolean;
}

class CacheService {
  private redis: Redis;
  private defaultTTL = 3600; // 1 hour

  constructor() {
    this.redis = new Redis({
      host: env.redisHost || 'localhost',
      port: env.redisPort || 6379,
      password: env.redisPassword,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      // Connection pooling
      family: 4,
      keepAlive: true,
      // Compression
      compression: 'gzip'
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis error:', error);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    try {
      const ttl = options.ttl || this.defaultTTL;
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  async del(key: string | string[]): Promise<void> {
    try {
      if (Array.isArray(key)) {
        if (key.length > 0) {
          await this.redis.del(...key);
        }
      } else {
        await this.redis.del(key);
      }
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      logger.error('Cache delete pattern error:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  // Cache keys for different data types
  static keys = {
    website: (id: string) => `website:${id}`,
    websiteComplete: (id: string) => `website:complete:${id}`,
    section: (id: string) => `section:${id}`,
    sectionsByWebsite: (websiteId: string, active?: boolean) => 
      `sections:website:${websiteId}:active:${active || 'all'}`,
    subsection: (id: string) => `subsection:${id}`,
    subsectionsBySection: (sectionId: string, active?: boolean) => 
      `subsections:section:${sectionId}:active:${active || 'all'}`,
    contentElements: (parentId: string, active?: boolean) => 
      `content:parent:${parentId}:active:${active || 'all'}`,
    translations: (elementId: string, languageId?: string) => 
      `translations:element:${elementId}:lang:${languageId || 'all'}`,
    userWebsites: (userId: string) => `user:${userId}:websites`
  };

  // Invalidation helpers
  async invalidateWebsite(websiteId: string): Promise<void> {
    await this.delPattern(`website:${websiteId}*`);
    await this.delPattern(`sections:website:${websiteId}*`);
    await this.delPattern(`*website:${websiteId}*`);
  }

  async invalidateSection(sectionId: string, websiteId?: string): Promise<void> {
    await this.delPattern(`section:${sectionId}*`);
    await this.delPattern(`subsections:section:${sectionId}*`);
    if (websiteId) {
      await this.delPattern(`sections:website:${websiteId}*`);
    }
  }

  async invalidateSubsection(subsectionId: string, sectionId?: string): Promise<void> {
    await this.delPattern(`subsection:${subsectionId}*`);
    await this.delPattern(`content:parent:${subsectionId}*`);
    if (sectionId) {
      await this.delPattern(`subsections:section:${sectionId}*`);
    }
  }
}

export default new CacheService();

