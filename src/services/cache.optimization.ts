
export class CacheOptimizer {
    /**
     * Preload frequently accessed data into cache
     * Call this during application startup or periodically
     */
    static async preloadCache() {
        try {
            console.log('Starting cache preload...');
            
            // Preload navigation data for all active websites
            // This is frequently accessed and changes rarely
            const WebSiteModel = require('../models/WebSite.model').default;
            const websites = await WebSiteModel.find({ isActive: true }).lean();
            
            const SubSectionService = require('../services/subSection.service').default;
            
            for (const website of websites) {
                // Preload navigation subsections
                await SubSectionService.getNavigationSubSectionsByWebSiteIdOptimized(
                    website._id.toString(),
                    true
                );
                
                // Preload basic sections
                const SectionService = require('../services/section.service').SectionService;
                await SectionService.prototype.getBasicSectionInfoOptimized(
                    { WebSiteId: website._id, isActive: true }
                );
            }
            
            console.log('Cache preload completed');
        } catch (error) {
            console.error('Cache preload error:', error);
        }
    }

    /**
     * Cache warming for specific website
     */
    static async warmWebsiteCache(websiteId: string) {
        try {
            const SubSectionService = require('../services/subSection.service').default;
            const SectionItemService = require('../services/sectionItem.service').default;
            
            // Warm up most commonly accessed data
            await Promise.all([
                SubSectionService.getCompleteSubSectionsByWebSiteIdOptimized(websiteId, true),
                SectionItemService.getSectionItemsByWebSiteIdOptimized(websiteId, true),
                SubSectionService.getNavigationSubSectionsByWebSiteIdOptimized(websiteId, true)
            ]);
            
            console.log(`Cache warmed for website: ${websiteId}`);
        } catch (error) {
            console.error(`Cache warming error for website ${websiteId}:`, error);
        }
    }

    /**
     * Monitor cache hit rates and performance
     */
    static async getCacheStats() {
        try {
            // You can extend this to get actual Redis stats
            return {
                timestamp: new Date().toISOString(),
                message: 'Cache monitoring active'
            };
        } catch (error) {
            console.error('Cache stats error:', error);
            return null;
        }
    }
}



export const performanceMonitor = (operationName: string) => {
    const start = Date.now();
    
    return {
        end: () => {
            const duration = Date.now() - start;
            if (duration > 1000) {
                console.warn(`Slow operation: ${operationName} took ${duration}ms`);
            } else {
                console.log(`${operationName} completed in ${duration}ms`);
            }
            return duration;
        }
    };
};
