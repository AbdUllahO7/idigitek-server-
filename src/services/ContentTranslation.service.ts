import mongoose from 'mongoose';
import { AppError } from '../middleware/errorHandler.middleware';
import LanguagesModel from '../models/languages.model';
import { IContentTranslation, ICreateContentTranslation, IUpdateContentTranslation } from '../types/ContentTranslation.type';
import ContentElementModel from '../models/ContentElement.model';
import ContentTranslationModel from '../models/ContentTranslation.model';

class ContentTranslationService {
  /**
   * Create a new content translation
   * @param data The translation data to create
   * @returns Promise with the created translation
   */
  async createTranslation(data: ICreateContentTranslation): Promise<IContentTranslation> {
    try {
      // Validate contentElement exists
      const elementExists = await ContentElementModel.exists({ _id: data.contentElement });
      if (!elementExists) {
        throw AppError.notFound(`Content element with ID ${data.contentElement} not found`);
      }

      // Validate language exists
      const languageExists = await LanguagesModel.exists({ _id: data.language });
      if (!languageExists) {
        throw AppError.notFound(`Language with ID ${data.language} not found`);
      }

      // Check if translation for this language and element already exists
      const existingTranslation = await ContentTranslationModel.findOne({
        contentElement: data.contentElement,
        language: data.language
      });

      if (existingTranslation) {
        throw AppError.badRequest('Translation for this content element and language already exists');
      }

      // Create the translation
      const translation = new ContentTranslationModel(data);
      return await translation.save();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to create translation', error);
    }
  }

  /**
   * Get translation by ID
   * @param id The translation ID
   * @returns Promise with the translation
   */
  async getTranslationById(id: string): Promise<IContentTranslation> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppError.validation('Invalid translation ID format');
      }

      const translation = await ContentTranslationModel.findById(id)
        .populate('language')
        .populate('contentElement');
      
      if (!translation) {
        throw AppError.notFound(`Translation with ID ${id} not found`);
      }
      
      return translation;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to retrieve translation', error);
    }
  }

  /**
   * Get all translations for a content element
   * @param contentElementId The content element ID
   * @param activeOnly Whether to return only active translations
   * @returns Promise with array of translations
   */
  async getTranslationsByContentElement(contentElementId: string, activeOnly: boolean = true): Promise<IContentTranslation[]> {
    try {
      if (!mongoose.Types.ObjectId.isValid(contentElementId)) {
        throw AppError.validation('Invalid content element ID format');
      }

      // Build query
      const query: any = { contentElement: contentElementId };
      if (activeOnly) {
        query.isActive = true;
      }

      // Get translations
      const translations = await ContentTranslationModel.find(query)
        .populate('language')
        .sort({ 'language.language': 1 });

      return translations;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to retrieve translations', error);
    }
  }

  /**
   * Get all translations for a language
   * @param languageId The language ID
   * @param activeOnly Whether to return only active translations
   * @returns Promise with array of translations
   */
  async getTranslationsByLanguage(languageId: string, activeOnly: boolean = true): Promise<IContentTranslation[]> {
    try {
      if (!mongoose.Types.ObjectId.isValid(languageId)) {
        throw AppError.validation('Invalid language ID format');
      }

      // Build query
      const query: any = { language: languageId };
      if (activeOnly) {
        query.isActive = true;
      }

      // Get translations
      const translations = await ContentTranslationModel.find(query)
        .populate('contentElement')
        .sort({ 'contentElement.order': 1 });

      return translations;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to retrieve translations', error);
    }
  }

  /**
   * Get specific translation by content element and language
   * @param contentElementId The content element ID
   * @param languageId The language ID
   * @returns Promise with the translation if found
   */
  async getTranslation(contentElementId: string, languageId: string): Promise<IContentTranslation | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(contentElementId)) {
        throw AppError.validation('Invalid content element ID format');
      }

      if (!mongoose.Types.ObjectId.isValid(languageId)) {
        throw AppError.validation('Invalid language ID format');
      }

      const translation = await ContentTranslationModel.findOne({
        contentElement: contentElementId,
        language: languageId
      }).populate('language').populate('contentElement');

      return translation;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to retrieve translation', error);
    }
  }

  /**
   * Update translation by ID
   * @param id The translation ID
   * @param updateData The data to update
   * @returns Promise with the updated translation
   */
  async updateTranslation(id: string, updateData: IUpdateContentTranslation): Promise<IContentTranslation> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppError.validation('Invalid translation ID format');
      }

      // If changing element or language, check for existing translations
      if (updateData.contentElement && updateData.language) {
        const existingTranslation = await ContentTranslationModel.findOne({
          _id: { $ne: id },
          contentElement: updateData.contentElement,
          language: updateData.language
        });

        if (existingTranslation) {
          throw AppError.badRequest('Translation for this content element and language already exists');
        }
      }

      // Update the translation
      const translation = await ContentTranslationModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate('language').populate('contentElement');
      
      if (!translation) {
        throw AppError.notFound(`Translation with ID ${id} not found`);
      }
      
      return translation;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to update translation', error);
    }
  }

  /**
   * Delete translation by ID
   * @param id The translation ID
   * @param hardDelete Whether to permanently delete
   * @returns Promise with the operation result
   */
  async deleteTranslation(id: string, hardDelete: boolean = false): Promise<{ success: boolean; message: string }> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppError.validation('Invalid translation ID format');
      }

      const translation = await ContentTranslationModel.findById(id);
      if (!translation) {
        throw AppError.notFound(`Translation with ID ${id} not found`);
      }

      if (hardDelete) {
        await ContentTranslationModel.findByIdAndDelete(id);
        return { success: true, message: 'Translation deleted successfully' };
      } else {
        // Soft delete - just mark as inactive
        translation.isActive = false;
        await translation.save();
        return { success: true, message: 'Translation deactivated successfully' };
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to delete translation', error);
    }
  }

  /**
   * Bulk create or update translations
   * @param translations Array of translation data
   * @returns Promise with success message and count
   */

  async bulkUpsertTranslations(translations: (ICreateContentTranslation & { id?: string })[]): 
    Promise<{ success: boolean; message: string; created: number; updated: number }> {
    try {
      let created = 0;
      let updated = 0;

      // Validate the input array
      if (!Array.isArray(translations) || translations.length === 0) {
        throw AppError.validation('Translations array must not be empty');
      }

      // Process each translation
      for (const item of translations) {
        try {
          // Validate required fields
          if (!item.contentElement || !mongoose.Types.ObjectId.isValid(item.contentElement as string)) {
            console.error(`Invalid contentElement: ${item.contentElement}`);
            throw AppError.validation(`Invalid contentElement ID: ${item.contentElement}`);
          }

          if (!item.language || !mongoose.Types.ObjectId.isValid(item.language as string)) {
            console.error(`Invalid language: ${item.language}`);
            throw AppError.validation(`Invalid language ID: ${item.language}`);
          }

          // Validate content element exists
          const elementExists = await ContentElementModel.exists({ _id: item.contentElement });
          if (!elementExists) {
            console.error(`Content element not found: ${item.contentElement}`);
            throw AppError.notFound(`Content element with ID ${item.contentElement} not found`);
          }

          // Validate language exists
          const languageExists = await LanguagesModel.exists({ _id: item.language });
          if (!languageExists) {
            console.error(`Language not found: ${item.language}`);
            throw AppError.notFound(`Language with ID ${item.language} not found`);
          }

          if (item.id && mongoose.Types.ObjectId.isValid(item.id)) {
            // Update existing translation
            const result = await ContentTranslationModel.findByIdAndUpdate(
              item.id,
              { $set: {
                content: item.content,
                isActive: item.isActive !== undefined ? item.isActive : true,
                metadata: item.metadata
              }},
              { runValidators: true, new: true }
            );
            
            if (!result) {
              console.error(`Translation not found for update: ${item.id}`);
              throw AppError.notFound(`Translation with ID ${item.id} not found for update`);
            }
            
            updated++;
          } else {
            // Check if translation already exists for this element and language
            const existingTranslation = await ContentTranslationModel.findOne({
              contentElement: item.contentElement,
              language: item.language
            });

            if (existingTranslation) {
              // Update existing
              existingTranslation.content = item.content;
              if (item.isActive !== undefined) existingTranslation.isActive = item.isActive;
              if (item.metadata) existingTranslation.metadata = item.metadata;
              await existingTranslation.save();
              updated++;
            } else {
              // Create new
              await new ContentTranslationModel({
                content: item.content,
                contentElement: item.contentElement,
                language: item.language,
                isActive: item.isActive !== undefined ? item.isActive : true,
                metadata: item.metadata
              }).save();
              created++;
            }
          }
        } catch (itemError) {
          console.error('Error processing translation item:', itemError);
          throw itemError; // Re-throw to be caught by the outer catch
        }
      }

      return { 
        success: true, 
        message: `Processed ${translations.length} translations: ${created} created, ${updated} updated`,
        created,
        updated
      };
    } catch (error) {
      console.error('Failed to process translations batch:', error);
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to process translations batch', error);
    }
  }
}

export default new ContentTranslationService();