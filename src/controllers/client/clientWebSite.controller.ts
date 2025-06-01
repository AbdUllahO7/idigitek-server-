import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../../middleware/errorHandler.middleware';
import { ClientWebSiteService } from '../../services/clinet/clientWebSite.service';

const clientWebSiteService = new ClientWebSiteService();

class ClientWebSiteController {
    /**
   * Get all websites for a specific user with sections and languages
   * @route GET /api/websites/special/user/:userId
   */
    async getWebSitesByUserIdWithDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
        const { userId } = req.params;

        // Validate userId format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return next(new AppError('Invalid user ID format', 400));
        }

        const websites = await clientWebSiteService.getWebSitesByUserIdWithDetails(userId);

        res.status(200).json({
            status: 'success',
            results: websites.length,
            data: {
            websites
            }
        });
        } catch (error) {
        next(error);
        }
    }
}

export default new ClientWebSiteController();
