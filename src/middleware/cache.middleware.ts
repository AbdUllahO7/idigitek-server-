// src/middleware/cache.middleware.ts
// Automatic cache invalidation middleware

import { Request, Response, NextFunction } from 'express';
import cacheService from '../services/cache.service';

/**
 * Cache invalidation middleware for automatic cache cleanup
 * Add this to routes that modify data
 */
export const cacheInvalidation = (patterns: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Store original json method
        const originalJson = res.json;
        
        // Override json method to invalidate cache after successful response
        res.json = function(body: any) {
            // Only invalidate if the response was successful
            if (res.statusCode >= 200 && res.statusCode < 300) {
                // Invalidate cache patterns asynchronously
                Promise.all(
                    patterns.map(pattern => {
                        // Replace placeholders with actual values from request
                        const resolvedPattern = pattern
                            .replace(':websiteId', req.params.websiteId || req.body.websiteId)
                            .replace(':sectionId', req.params.sectionId || req.body.sectionId)
                            .replace(':id', req.params.id);
                        
                        return cacheService.delPattern(resolvedPattern);
                    })
                ).catch(err => console.error('Cache invalidation error:', err));
            }
            
            // Call original json method
            return originalJson.call(this, body);
        };
        
        next();
    };
};

