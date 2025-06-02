// backend/controllers/WebSiteTheme.controller.ts

import { Request, Response } from 'express';
import { WebSiteThemeService } from '../services/WebSiteTheme.service';

export class WebSiteThemeController {
  private themeService: WebSiteThemeService;

  constructor() {
    this.themeService = new WebSiteThemeService();
  }

  // Create a new theme
  createTheme = async (req: Request, res: Response): Promise<void> => {
    try {
      const themeData = req.body;
      const theme = await this.themeService.createTheme(themeData);

      res.status(201).json({
        success: true,
        message: 'Theme created successfully',
        data: theme,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
        data: null,
      });
    }
  };

  // Get all themes for a website
  getThemesByWebSite = async (req: Request, res: Response): Promise<void> => {
    try {
      const { websiteId } = req.params;
      const themes = await this.themeService.getThemesByWebSiteId(websiteId);

      res.status(200).json({
        success: true,
        message: 'Themes retrieved successfully',
        data: themes,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
        data: null,
      });
    }
  };

  // Get active theme for a website
  getActiveTheme = async (req: Request, res: Response): Promise<void> => {
    try {
      const { websiteId } = req.params;
      const theme = await this.themeService.getActiveTheme(websiteId);

      if (!theme) {
        res.status(404).json({
          success: false,
          message: 'No active theme found for this website',
          data: null,
        });
        return;
      }
      res.status(200).json({
        success: true,
        message: 'Active theme retrieved successfully',
        data: theme,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
        data: null,
      });
    }
  };

  // Get theme by ID
  getThemeById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { themeId } = req.params;
      const theme = await this.themeService.getThemeById(themeId);

      if (!theme) {
        res.status(404).json({
          success: false,
          message: 'Theme not found',
          data: null,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Theme retrieved successfully',
        data: theme,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
        data: null,
      });
    }
  };

  // Update theme
  updateTheme = async (req: Request, res: Response): Promise<void> => {
    try {
      const { themeId } = req.params;
      const updateData = req.body;

      const theme = await this.themeService.updateTheme(themeId, updateData);

      if (!theme) {
        res.status(404).json({
          success: false,
          message: 'Theme not found',
          data: null,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Theme updated successfully',
        data: theme,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
        data: null,
      });
    }
  };

  // Update theme colors only
  updateThemeColors = async (req: Request, res: Response): Promise<void> => {
    try {
      const { themeId } = req.params;
      const { colors } = req.body;

      if (!colors || (!colors.light && !colors.dark)) {
        res.status(400).json({
          success: false,
          message: 'Colors data (light or dark) is required',
          data: null,
        });
        return;
      }

      const theme = await this.themeService.updateThemeColors(themeId, colors);

      if (!theme) {
        res.status(404).json({
          success: false,
          message: 'Theme not found',
          data: null,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Theme colors updated successfully',
        data: theme,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
        data: null,
      });
    }
  };

  // Update theme fonts only
  updateThemeFonts = async (req: Request, res: Response): Promise<void> => {
    try {
      const { themeId } = req.params;
      const { fonts } = req.body;

      if (!fonts) {
        res.status(400).json({
          success: false,
          message: 'Fonts data is required',
          data: null,
        });
        return;
      }

      const theme = await this.themeService.updateThemeFonts(themeId, fonts);

      if (!theme) {
        res.status(404).json({
          success: false,
          message: 'Theme not found',
          data: null,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Theme fonts updated successfully',
        data: theme,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
        data: null,
      });
    }
  };

  // Set active theme
  setActiveTheme = async (req: Request, res: Response): Promise<void> => {
    try {
      const { websiteId, themeId } = req.params;

      const theme = await this.themeService.setActiveTheme(websiteId, themeId);

      if (!theme) {
        res.status(404).json({
          success: false,
          message: 'Theme not found for this website',
          data: null,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Active theme set successfully',
        data: theme,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
        data: null,
      });
    }
  };

  // Delete theme
  deleteTheme = async (req: Request, res: Response): Promise<void> => {
    try {
      const { themeId } = req.params;
      const deleted = await this.themeService.deleteTheme(themeId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Theme not found',
          data: null,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Theme deleted successfully',
        data: null,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
        data: null,
      });
    }
  };

  // Clone theme
  cloneTheme = async (req: Request, res: Response): Promise<void> => {
    try {
      const { themeId } = req.params;
      const { themeName } = req.body;

      if (!themeName) {
        res.status(400).json({
          success: false,
          message: 'Theme name is required for cloning',
          data: null,
        });
        return;
      }

      const clonedTheme = await this.themeService.cloneTheme(themeId, themeName);

      res.status(201).json({
        success: true,
        message: 'Theme cloned successfully',
        data: clonedTheme,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
        data: null,
      });
    }
  };

  // Get all themes (admin function)
  getAllThemes = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await this.themeService.getAllThemes(page, limit);

      res.status(200).json({
        success: true,
        message: 'All themes retrieved successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
        data: null,
      });
    }
  };
}