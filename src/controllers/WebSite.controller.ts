import { Request, Response, NextFunction } from 'express';

import { WebSiteProps } from '../types/WebSite.type';
import { WebSiteService } from '../services/WebSite.service';
import { AppError } from '../middleware/errorHandler.middleware';
import mongoose from 'mongoose';
import { File } from 'multer';
import fs from 'fs-extra';

const webSiteService = new WebSiteService();

export class WebSiteController {
  /**
   * Create a new website
   * @route POST /api/websites
   */
  async createWebSite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user.id; // Assuming req.user is set by auth middleware
      const webSiteData: WebSiteProps = req.body;
      
      const newWebSite = await webSiteService.createWebSite(webSiteData, userId);
      
      res.status(201).json({
        status: 'success',
        data: {
          website: newWebSite
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
 * Upload logo image for a website
 * @route POST /api/websites/:id/logo
 */
  async uploadWebSiteLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
    const file = req.file  as File; 
    try {
      const { id } = req?.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new AppError('Invalid website ID format', 400));
      }
      if (!file) {
        return next(new AppError('No image file provided', 400));
      }
      
      const updatedWebsite = await webSiteService.uploadWebSiteLogo(id, file);

      res.status(200).json({
        status: 'success',
        data: {
          website: updatedWebsite
        },
        message: 'Website logo uploaded successfully'
      });
    } catch (error) {
      next(error);
    } finally {
      // Clean up the temporary file
      if (file && file.path) {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Error removing temporary file:', err);
        });
      }
    }
  }

  
  /**
   * Get all websites
   * @route GET /api/websites
   */
  async getAllWebSites(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const websites = await webSiteService.getAllWebSites();
      
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
  
  /**
   * Get a website by ID
   * @route GET /api/websites/:id
   */
  async getWebSiteById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const website = await webSiteService.getWebSiteById(id);
      
      if (!website) {
        return next(new AppError('Website not found', 404));
      }
      
      res.status(200).json({
        status: 'success',
        data: {
          website
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get all websites for the current user
   * @route GET /api/websites/my
   */
  async getMyWebSites(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user.id; // Assuming req.user is set by auth middleware
      const websites = await webSiteService.getWebSitesByUserId(userId);
      
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
  
  /**
   * Update a website by ID
   * @route PATCH /api/websites/:id
   */
  async updateWebSite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user.id; // Assuming req.user is set by auth middleware
      const updateData: Partial<WebSiteProps> = req.body;
      
      const updatedWebSite = await webSiteService.updateWebSite(id, updateData, userId);
      
      if (!updatedWebSite) {
        return next(new AppError('Website not found', 404));
      }
      
      res.status(200).json({
        status: 'success',
        data: {
          websiteId: updatedWebSite
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Delete a website by ID
   * @route DELETE /api/websites/:id
   */
  async deleteWebSite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user.id; // Assuming req.user is set by auth middleware
      
      const deletedWebSite = await webSiteService.deleteWebSite(id, userId);
      
      if (!deletedWebSite) {
        return next(new AppError('Website not found', 404));
      }
      
      res.status(204).json({
        status: 'success',
        data: null
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Add a user to a website
   * @route POST /api/websites/:id/users
   */
  async addUserToWebSite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { userId, role } = req.body;
      const requestingUserId = req.user.id; // Assuming req.user is set by auth middleware
      
      if (!userId || !role) {
        return next(new AppError('Please provide both userId and role', 400));
      }
      
      const result = await webSiteService.addUserToWebSite(id, userId, role, requestingUserId);
      
      res.status(200).json({
        status: 'success',
        data: {
          websiteUser: result
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Remove a user from a website
   * @route DELETE /api/websites/:id/users/:userId
   */
  async removeUserFromWebSite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, userId } = req.params;
      const requestingUserId = req.user.id; // Assuming req.user is set by auth middleware
      
      const result = await webSiteService.removeUserFromWebSite(id, userId, requestingUserId);
      
      if (!result) {
        return next(new AppError('User not found or not associated with this website', 404));
      }
      
      res.status(204).json({
        status: 'success',
        data: null
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get all users for a website
   * @route GET /api/websites/:id/users
   */
  async getWebSiteUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const requestingUserId = req.user.id; // Assuming req.user is set by auth middleware      
      const users = await webSiteService.getWebSiteUsers(id, requestingUserId);
      res.status(200).json({
        status: 'success',
        results: users.length,
        data: {
          users
        }
      });
    } catch (error) {
      next(error);
    }
  }
}