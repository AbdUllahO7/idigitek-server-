import mongoose, { Types } from 'mongoose';
import { AppError } from '../middleware/errorHandler.middleware';
import LanguagesModel from '../models/languages.model';
import { IContentTranslation, ICreateContentTranslation, IUpdateContentTranslation } from '../types/ContentTranslation.type';
import ContentElementModel from '../models/ContentElement.model';
import ContentTranslationModel from '../models/ContentTranslation.model';
import Redis from 'ioredis';

// Initialize Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
});

class ContentTranslationService {
  /**
   * Create a new content translation
   * @param data The translation data to create
   * @returns Promise with the created translation
   */
  async createTranslation(data: ICreateContentTranslation): Promise<IContentTranslation> {
    const session = await mongoose.startSession();
    let isTransactionActive = false;

    try {
      await session.startTransaction();
      isTransactionActive = true;

      // Validate contentElement and language existence (lean for performance)
      const [elementExists, languageExists] = await Promise.all([
        ContentElementModel.exists({ _id: data.contentElement }).lean().session(session),
        LanguagesModel.exists({ _id: data.language }).lean().session(session),
      ]);

      if (!elementExists) {
        throw AppError.notFound(`Content element with ID ${data.contentElement} not found`);
      }
      if (!languageExists) {
        throw AppError.notFound(`Language with ID ${data.language} not found`);
      }

      // Check for existing translation
      const existingTranslation = await ContentTranslationModel.findOne({
        contentElement: data.contentElement,
        language: data.language,
      }).lean().session(session);

      if (existingTranslation) {
        throw AppError.badRequest('Translation for this content element and language already exists');
      }

      // Create translation
      const translation = await ContentTranslationModel.create([data], { session });
      
      await session.commitTransaction();
      isTransactionActive = false;
      
      return translation[0];
    } catch (error) {
      if (isTransactionActive) {
        try {
          await session.abortTransaction();
        } catch (abortError) {
          console.error('Error aborting transaction in createTranslation:', abortError);
        }
      }
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to create translation', error);
    } finally {
      try {
        session.endSession();
      } catch (endError) {
        console.error('Error ending session in createTranslation:', endError);
      }
    }
  }

  /**
   * Get translation by ID with caching
   * @param id The translation ID
   * @returns Promise with the translation
   */
  async getTranslationById(id: string): Promise<IContentTranslation> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AppError.validation('Invalid translation ID format');
      }

      // Check cache
      const cacheKey = `translation:${id}`;
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const translation = await ContentTranslationModel.findLean({ _id: id })
        .populate('language')
        .populate('contentElement');

      if (!translation.length) {
        throw AppError.notFound(`Translation with ID ${id} not found`);
      }

      await redis.set(cacheKey, JSON.stringify(translation[0]), 'EX', 3600); // Cache for 1 hour
      return translation[0];
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to retrieve translation', error);
    }
  }

  /**
   * Get all translations for a content element with caching
   * @param contentElementId The content element ID
   * @param activeOnly Whether to return only active translations
   * @returns Promise with array of translations
   */
  async getTranslationsByContentElement(contentElementId: string, activeOnly: boolean = true): Promise<IContentTranslation[]> {
    try {
      if (!Types.ObjectId.isValid(contentElementId)) {
        throw AppError.validation('Invalid content element ID format');
      }

      // Check cache
      const cacheKey = `translations:contentElement:${contentElementId}:${activeOnly}`;
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const query: any = { contentElement: contentElementId };
      if (activeOnly) query.isActive = true;

      const translations = await ContentTranslationModel.findLean(query)
        .populate('language')
        .sort({ 'language.language': 1 });

      await redis.set(cacheKey, JSON.stringify(translations), 'EX', 3600); // Cache for 1 hour
      return translations;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to retrieve translations', error);
    }
  }

  /**
   * Get all translations for a language with caching
   * @param languageId The language ID
   * @param activeOnly Whether to return only active translations
   * @returns Promise with array of translations
   */
  async getTranslationsByLanguage(languageId: string, activeOnly: boolean = true): Promise<IContentTranslation[]> {
    try {
      if (!Types.ObjectId.isValid(languageId)) {
        throw AppError.validation('Invalid language ID format');
      }

      // Check cache
      const cacheKey = `translations:language:${languageId}:${activeOnly}`;
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const query: any = { language: languageId };
      if (activeOnly) query.isActive = true;

      const translations = await ContentTranslationModel.findLean(query)
        .populate('contentElement')
        .sort({ 'contentElement.order': 1 });

      await redis.set(cacheKey, JSON.stringify(translations), 'EX', 3600); // Cache for 1 hour
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
      if (!Types.ObjectId.isValid(contentElementId) || !Types.ObjectId.isValid(languageId)) {
        throw AppError.validation('Invalid content element or language ID format');
      }

      // Check cache
      const cacheKey = `translation:${contentElementId}:${languageId}`;
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const translation = await ContentTranslationModel.findLean({
        contentElement: contentElementId,
        language: languageId,
      })
        .populate('language')
        .populate('contentElement');

      const result = translation.length ? translation[0] : null;
      await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600); // Cache for 1 hour
      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to retrieve translation', error);
    }
  }

  /**
   * Update translation by ID - FIXED VERSION
   * @param id The translation ID
   * @param updateData The data to update
   * @returns Promise with the updated translation
   */
  async updateTranslation(id: string, updateData: IUpdateContentTranslation): Promise<IContentTranslation> {
    const session = await mongoose.startSession();
    let isTransactionActive = false;

    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AppError.validation('Invalid translation ID format');
      }

      await session.startTransaction();
      isTransactionActive = true;

      // Validate new contentElement or language if provided
      if (updateData.contentElement || updateData.language) {
        const [elementExists, languageExists] = await Promise.all([
          updateData.contentElement
            ? ContentElementModel.exists({ _id: updateData.contentElement }).lean().session(session)
            : Promise.resolve(true),
          updateData.language
            ? LanguagesModel.exists({ _id: updateData.language }).lean().session(session)
            : Promise.resolve(true),
        ]);

        if (updateData.contentElement && !elementExists) {
          throw AppError.notFound(`Content element with ID ${updateData.contentElement} not found`);
        }
        if (updateData.language && !languageExists) {
          throw AppError.notFound(`Language with ID ${updateData.language} not found`);
        }

        // Check for existing translation conflict
        if (updateData.contentElement && updateData.language) {
          const existingTranslation = await ContentTranslationModel.findOne({
            _id: { $ne: id },
            contentElement: updateData.contentElement,
            language: updateData.language,
          }).lean().session(session);

          if (existingTranslation) {
            throw AppError.badRequest('Translation for this content element and language already exists');
          }
        }
      }

      // Update translation
      const translation = await ContentTranslationModel.findByIdAndUpdate(
        id,
        { 
          $set: {
            ...updateData,
            updatedAt: new Date() // Ensure updatedAt is set
          }
        },
        { 
          new: true, 
          runValidators: true, 
          lean: true,
          session // Make sure to use the session
        }
      );

      if (!translation) {
        throw AppError.notFound(`Translation with ID ${id} not found`);
      }

      // Commit the transaction
      await session.commitTransaction();
      isTransactionActive = false;

      // Invalidate cache (do this after successful transaction)
      try {
        await this.invalidateTranslationCache(translation);
      } catch (cacheError) {
        console.error('Cache invalidation error (non-fatal):', cacheError);
        // Don't fail the request for cache errors
      }

      return translation;
    } catch (error) {
      if (isTransactionActive) {
        try {
          await session.abortTransaction();
        } catch (abortError) {
          console.error('Error aborting transaction in updateTranslation:', abortError);
        }
      }
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to update translation', error);
    } finally {
      try {
        session.endSession();
      } catch (endError) {
        console.error('Error ending session in updateTranslation:', endError);
      }
    }
  }

  /**
   * Helper method to invalidate translation cache
   * @param translation The translation object
   */
  private async invalidateTranslationCache(translation: any): Promise<void> {
    try {
      await Promise.all([
        redis.del(`translation:${translation._id}`),
        redis.del(`translation:${translation.contentElement}:${translation.language}`),
        redis.keys(`translations:*${translation.contentElement}*`).then((keys) => 
          keys.length > 0 ? redis.del(...keys) : Promise.resolve()
        ),
        redis.keys(`translations:*${translation.language}*`).then((keys) => 
          keys.length > 0 ? redis.del(...keys) : Promise.resolve()
        ),
      ]);
    } catch (error) {
      console.error('Cache invalidation error:', error);
      // Don't throw - cache errors should not fail the main operation
    }
  }

  /**
   * Delete translation by ID
   * @param id The translation ID
   * @param hardDelete Whether to permanently delete
   * @returns Promise with the operation result
   */
  async deleteTranslation(id: string, hardDelete: boolean = false): Promise<{ success: boolean; message: string }> {
    const session = await mongoose.startSession();
    let isTransactionActive = false;

    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AppError.validation('Invalid translation ID format');
      }

      await session.startTransaction();
      isTransactionActive = true;

      const translation = await ContentTranslationModel.findById(id).lean().session(session);
      if (!translation) {
        throw AppError.notFound(`Translation with ID ${id} not found`);
      }

      if (hardDelete) {
        await ContentTranslationModel.findByIdAndDelete(id).session(session);
      } else {
        await ContentTranslationModel.findByIdAndUpdate(
          id, 
          { $set: { isActive: false, updatedAt: new Date() } },
          { session }
        );
      }

      await session.commitTransaction();
      isTransactionActive = false;

      // Invalidate cache
      try {
        await this.invalidateTranslationCache(translation);
      } catch (cacheError) {
        console.error('Cache invalidation error (non-fatal):', cacheError);
      }

      return {
        success: true,
        message: hardDelete ? 'Translation deleted successfully' : 'Translation deactivated successfully',
      };
    } catch (error) {
      if (isTransactionActive) {
        try {
          await session.abortTransaction();
        } catch (abortError) {
          console.error('Error aborting transaction in deleteTranslation:', abortError);
        }
      }
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to delete translation', error);
    } finally {
      try {
        session.endSession();
      } catch (endError) {
        console.error('Error ending session in deleteTranslation:', endError);
      }
    }
  }

  /**
   * Bulk create or update translations - IMPROVED VERSION
   * @param translations Array of translation data
   * @returns Promise with success message and count
   */
  async bulkUpsertTranslations(translations: (ICreateContentTranslation & { id?: string })[]): 
    Promise<{ success: boolean; message: string; created: number; updated: number }> {
    
    // Validate the input array first
    if (!Array.isArray(translations) || translations.length === 0) {
      throw AppError.validation('Translations array must not be empty');
    }

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    // Process translations sequentially to avoid transaction conflicts
    for (let i = 0; i < translations.length; i++) {
      const item = translations[i];
      const session = await mongoose.startSession();
      let isTransactionActive = false;

      try {
        // Validate required fields
        if (!item.contentElement || !mongoose.Types.ObjectId.isValid(item.contentElement as string)) {
          throw AppError.validation(`Invalid contentElement ID: ${item.contentElement}`);
        }

        if (!item.language || !mongoose.Types.ObjectId.isValid(item.language as string)) {
          throw AppError.validation(`Invalid language ID: ${item.language}`);
        }

        await session.startTransaction();
        isTransactionActive = true;

        // Validate content element and language exist
        const [elementExists, languageExists] = await Promise.all([
          ContentElementModel.exists({ _id: item.contentElement }).session(session),
          LanguagesModel.exists({ _id: item.language }).session(session)
        ]);

        if (!elementExists) {
          throw AppError.notFound(`Content element with ID ${item.contentElement} not found`);
        }

        if (!languageExists) {
          throw AppError.notFound(`Language with ID ${item.language} not found`);
        }

        if (item.id && mongoose.Types.ObjectId.isValid(item.id)) {
          // Update existing translation
          const result = await ContentTranslationModel.findByIdAndUpdate(
            item.id,
            { 
              $set: {
                content: item.content,
                isActive: item.isActive !== undefined ? item.isActive : true,
                metadata: item.metadata,
                updatedAt: new Date()
              }
            },
            { runValidators: true, new: true, session }
          );
          
          if (!result) {
            throw AppError.notFound(`Translation with ID ${item.id} not found for update`);
          }
          
          updated++;
        } else {
          // Check if translation already exists for this element and language
          const existingTranslation = await ContentTranslationModel.findOne({
            contentElement: item.contentElement,
            language: item.language
          }).session(session);

          if (existingTranslation) {
            // Update existing
            await ContentTranslationModel.findByIdAndUpdate(
              existingTranslation._id,
              {
                $set: {
                  content: item.content,
                  isActive: item.isActive !== undefined ? item.isActive : true,
                  metadata: item.metadata,
                  updatedAt: new Date()
                }
              },
              { runValidators: true, session }
            );
            updated++;
          } else {
            // Create new
            await ContentTranslationModel.create([{
              content: item.content,
              contentElement: item.contentElement,
              language: item.language,
              isActive: item.isActive !== undefined ? item.isActive : true,
              metadata: item.metadata
            }], { session });
            created++;
          }
        }

        await session.commitTransaction();
        isTransactionActive = false;

      } catch (itemError) {
        if (isTransactionActive) {
          try {
            await session.abortTransaction();
          } catch (abortError) {
            console.error('Error aborting transaction in bulkUpsertTranslations:', abortError);
          }
        }
        
        const errorMessage = `Item ${i + 1}: ${itemError instanceof Error ? itemError.message : String(itemError)}`;
        errors.push(errorMessage);
        console.error('Error processing translation item:', errorMessage);
        
      } finally {
        try {
          session.endSession();
        } catch (endError) {
          console.error('Error ending session in bulkUpsertTranslations:', endError);
        }
      }

      // Add small delay between operations to prevent overwhelming the database
      if (i < translations.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    if (errors.length > 0) {
      console.error('Bulk upsert completed with errors:', errors);
      throw AppError.database(`Bulk operation completed with ${errors.length} errors: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`);
    }

    return { 
      success: true, 
      message: `Processed ${translations.length} translations: ${created} created, ${updated} updated`,
      created,
      updated
    };
  }
}

export default new ContentTranslationService();