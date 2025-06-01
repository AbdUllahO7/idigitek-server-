import mongoose from "mongoose";
import LanguageModel from "../models/languages.model";
import { ILanguages, ICreateLanguage, IUpdateLanguage } from "../types/languages.types";
import { AppError } from "../middleware/errorHandler.middleware";
import WebSiteModel from "../models/WebSite.model";

export class LanguageService {
  // Create a new language for a website
  async createLanguage(languageData: ICreateLanguage) {
    try {
      // Verify that the website exists
      if (!languageData.websiteId) {
        throw AppError.badRequest('Website ID is required');
      }

      if (!mongoose.Types.ObjectId.isValid(languageData.websiteId)) {
        throw AppError.validation('Invalid website ID format');
      }

      const website = await WebSiteModel.findById(languageData.websiteId);
      if (!website) {
        throw AppError.notFound(`Website with ID ${languageData.websiteId} not found`);
      }
      
      const language = new LanguageModel({
        language: languageData.language,
        languageID: languageData.languageID,
        isActive: languageData.isActive || false,
        websiteId: languageData.websiteId,
        subSections: languageData.subSections || []
      });
      
      await language.save();
      return language;
    } catch (error) {
      if (error.code === 11000) {
        // Handle duplicate key error
        const field = Object.keys(error.keyPattern)[0];
        if (error.keyPattern.websiteId && (error.keyPattern.language || error.keyPattern.languageID)) {
          throw new Error(`Language with this ${field === 'websiteId' ? 'combination' : field} already exists for this website`);
        } else {
          throw new Error(`Language with this ${field} already exists`);
        }
      }
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to create language', error);
    }
  }

  // Get all languages, optionally filtered by websiteId
  async getAllLanguages(query: any = {}) {
    try {
      // If websiteId is provided, validate it
      if (query.websiteId && !mongoose.Types.ObjectId.isValid(query.websiteId)) {
        throw AppError.validation('Invalid website ID format');
      }
      
      const languages = await LanguageModel.find(query).populate('subSections');
      return languages;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to retrieve languages', error);
    }
  }

  // Get languages for a specific website
  async getLanguagesByWebsite(websiteId: string) {
    try {
      if (!mongoose.Types.ObjectId.isValid(websiteId)) {
        throw AppError.validation('Invalid website ID format');
      }
      
      const languages = await LanguageModel.find({ websiteId }).populate('subSections');
      return languages;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to retrieve languages for website', error);
    }
  }

  // Get language by ID
  async getLanguageById(id: string) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppError.validation('Invalid language ID format');
      }
      
      const language = await LanguageModel.findById(id).populate('subSections');
      if (!language) {
        throw AppError.notFound('Language not found');
      }
      return language;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to retrieve language', error);
    }
  }

  // Update language
  async updateLanguage(id: string, updateData: IUpdateLanguage) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppError.validation('Invalid language ID format');
      }
      
      // If websiteId is being changed, verify the new website exists
      if (updateData.websiteId) {
        if (!mongoose.Types.ObjectId.isValid(updateData.websiteId)) {
          throw AppError.validation('Invalid website ID format');
        }
        
        const website = await WebSiteModel.findById(updateData.websiteId);
        if (!website) {
          throw AppError.notFound(`Website with ID ${updateData.websiteId} not found`);
        }
      }
      
      const language = await LanguageModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate('subSections');
      
      if (!language) {
        throw AppError.notFound('Language not found');
      }
      
      return language;
    } catch (error) {
      if (error.code === 11000) {
        // Handle duplicate key error
        const field = Object.keys(error.keyPattern)[0];
        if (error.keyPattern.websiteId && (error.keyPattern.language || error.keyPattern.languageID)) {
          throw AppError.badRequest(`Language with this ${field === 'websiteId' ? 'combination' : field} already exists for this website`);
        } else {
          throw AppError.badRequest(`Language with this ${field} already exists`);
        }
      }
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to update language', error);
    }
  }

  // Delete language
  async deleteLanguage(id: string) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppError.validation('Invalid language ID format');
      }
      
      const language = await LanguageModel.findByIdAndDelete(id);
      if (!language) {
        throw AppError.notFound('Language not found');
      }
      
      return { message: 'Language deleted successfully' };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to delete language', error);
    }
  }

  // Update language active status
  async updateLanguageActiveStatus(id: string, isActive: boolean): Promise<ILanguages> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppError.validation('Invalid language ID format');
      }
      
      const language = await LanguageModel.findByIdAndUpdate(
        id,
        { $set: { isActive } },
        { new: true, runValidators: true }
      ).populate('subSections');
      
      if (!language) {
        throw AppError.notFound(`Language with ID ${id} not found`);
      }
      
      return language;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to update language active status', error);
    }
  }

  // Toggle language active status
  async toggleLanguageStatus(id: string): Promise<ILanguages> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppError.validation('Invalid language ID format');
      }
      
      const language = await LanguageModel.findById(id);
      
      if (!language) {
        throw AppError.notFound(`Language with ID ${id} not found`);
      }
      
      // Toggle the isActive status
      language.isActive = !language.isActive;
      
      await language.save();
      
      return language;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to toggle language status', error);
    }
  }

  // Batch update language statuses
  async batchUpdateLanguageStatuses(updates: { id: string; isActive: boolean }[]): Promise<{ success: boolean; message: string; updatedCount: number }> {
    try {
      if (!updates || !Array.isArray(updates) || updates.length === 0) {
        throw AppError.badRequest('No updates provided');
      }
      
      // Validate all IDs
      for (const update of updates) {
        if (!mongoose.Types.ObjectId.isValid(update.id)) {
          throw AppError.validation(`Invalid language ID format: ${update.id}`);
        }
        
        if (typeof update.isActive !== 'boolean') {
          throw AppError.validation(`isActive must be a boolean for language ID: ${update.id}`);
        }
      }
      
      // Prepare bulk operations
      const bulkOps = updates.map(update => ({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(update.id) },
          update: { $set: { isActive: update.isActive } }
        }
      }));
      
      const result = await LanguageModel.bulkWrite(bulkOps);
      
      return { 
        success: true, 
        message: `Updated status for ${result.modifiedCount} languages`, 
        updatedCount: result.modifiedCount 
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to update language statuses', error);
    }
  }
}