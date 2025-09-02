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

  // Log incoming request data
  console.log('=== TRANSLATION CREATE REQUEST ===');
  console.log('Request Data:', JSON.stringify(data, null, 2));
  console.log('Data Types:', {
    contentElement: typeof data.contentElement,
    language: typeof data.language,
    content: typeof data.content,
    isActive: typeof data.isActive
  });

  try {
    await session.startTransaction();
    isTransactionActive = true;
    console.log('✅ Transaction started successfully');

    // Enhanced validation with detailed logging
    console.log('🔍 Starting validation checks...');
    
    // Validate ObjectId formats first
    if (!mongoose.Types.ObjectId.isValid(data.contentElement)) {
      console.error('❌ Invalid contentElement ObjectId format:', data.contentElement);
      throw AppError.validation(`Invalid contentElement ID format: ${data.contentElement}`);
    }
    
    if (!mongoose.Types.ObjectId.isValid(data.language)) {
      console.error('❌ Invalid language ObjectId format:', data.language);
      throw AppError.validation(`Invalid language ID format: ${data.language}`);
    }

    console.log('✅ ObjectId formats are valid');

    // Check database existence
    console.log('🔍 Checking database existence...');
    
    const elementExistsPromise = ContentElementModel.exists({ _id: data.contentElement }).lean().session(session);
    const languageExistsPromise = LanguagesModel.exists({ _id: data.language }).lean().session(session);

    const [elementExists, languageExists] = await Promise.all([
      elementExistsPromise.catch(err => {
        console.error('❌ Error checking element existence:', err);
        throw err;
      }),
      languageExistsPromise.catch(err => {
        console.error('❌ Error checking language existence:', err);
        throw err;
      })
    ]);

    console.log('Database existence results:', {
      elementExists: !!elementExists,
      languageExists: !!languageExists,
      elementId: elementExists?._id,
      languageId: languageExists?._id
    });

    if (!elementExists) {
      const error = `Content element with ID ${data.contentElement} not found`;
      console.error('❌ Element not found:', error);
      throw AppError.notFound(error);
    }
    
    if (!languageExists) {
      const error = `Language with ID ${data.language} not found`;
      console.error('❌ Language not found:', error);
      throw AppError.notFound(error);
    }

    console.log('✅ Database existence validation passed');

    // Check for duplicate translation
    console.log('🔍 Checking for existing translation...');
    
    const existingTranslation = await ContentTranslationModel.findOne({
      contentElement: data.contentElement,
      language: data.language,
    }).lean().session(session).catch(err => {
      console.error('❌ Error checking existing translation:', err);
      throw err;
    });

    console.log('Existing translation check result:', {
      found: !!existingTranslation,
      translationId: existingTranslation?._id,
      isActive: existingTranslation?.isActive
    });

    if (existingTranslation) {
      const error = 'Translation for this content element and language already exists';
      console.error('❌ Duplicate translation found:', {
        existingId: existingTranslation._id,
        contentElement: data.contentElement,
        language: data.language,
        isActive: existingTranslation.isActive
      });
      throw AppError.badRequest(error);
    }

    console.log('✅ No duplicate translation found');

    // Prepare translation data with explicit field mapping
    const translationData = {
      content: data.content,
      contentElement: new mongoose.Types.ObjectId(data.contentElement as string),
      language: new mongoose.Types.ObjectId(data.language as string),
      isActive: data.isActive !== undefined ? data.isActive : true,
      metadata: data.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('📝 Prepared translation data:', {
      contentLength: translationData.content?.length,
      contentElement: translationData.contentElement.toString(),
      language: translationData.language.toString(),
      isActive: translationData.isActive,
      hasMetadata: Object.keys(translationData.metadata).length > 0
    });

    // Create translation with detailed error handling
    console.log('✨ Creating translation document...');
    
    const translation = await ContentTranslationModel.create([translationData], { session })
      .catch(err => {
        console.error('❌ MongoDB create error:', {
          name: err.name,
          message: err.message,
          code: err.code,
          codeName: err.codeName,
          writeErrors: err.writeErrors,
          validationErrors: err.errors
        });
        throw err;
      });

    if (!translation || translation.length === 0) {
      console.error('❌ Translation creation returned empty result');
      throw new Error('Translation creation failed - empty result');
    }

    console.log('✅ Translation document created:', {
      id: translation[0]._id,
      contentElement: translation[0].contentElement,
      language: translation[0].language,
      contentLength: translation[0].content?.length
    });

    // Commit transaction
    console.log('💾 Committing transaction...');
    await session.commitTransaction().catch(err => {
      console.error('❌ Transaction commit error:', err);
      throw err;
    });
    
    isTransactionActive = false;
    console.log('✅ Transaction committed successfully');

    console.log('=== TRANSLATION CREATE SUCCESS ===');
    return translation[0];

  } catch (error) {
    console.log('=== TRANSLATION CREATE ERROR ===');
    console.error('💥 Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 10).join('\n'),
      isAppError: error instanceof AppError,
      isMongoError: error.name?.includes('Mongo'),
      isValidationError: error.name === 'ValidationError',
      transactionActive: isTransactionActive
    });

    if (isTransactionActive) {
      console.log('🔄 Aborting transaction...');
      try {
        await session.abortTransaction();
        console.log('✅ Transaction aborted successfully');
      } catch (abortError) {
        console.error('💥 Transaction abort error:', {
          name: abortError.name,
          message: abortError.message
        });
      }
    }

    if (error instanceof AppError) {
      console.log('📤 Throwing AppError');
      throw error;
    }

    console.log('📤 Creating database AppError');
    throw AppError.database('Failed to create translation', {
      originalError: error.message,
      errorName: error.name,
      errorCode: error.code
    });

  } finally {
    console.log('🧹 Cleaning up session...');
    try {
      session.endSession();
      console.log('✅ Session ended successfully');
    } catch (endError) {
      console.error('💥 Session cleanup error:', {
        name: endError.name,
        message: endError.message
      });
    }
    console.log('=== TRANSLATION CREATE END ===\n');
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
/**
 * Bulk create or update translations - FIXED VERSION with proper transaction handling
 * @param translations Array of translation data
 * @returns Promise with success message and count
 */
async bulkUpsertTranslations(translations: (ICreateContentTranslation & { id?: string })[]): 
  Promise<{ success: boolean; message: string; created: number; updated: number; errors?: string[] }> {
  
  // Validate the input array first
  if (!Array.isArray(translations) || translations.length === 0) {
    throw AppError.validation('Translations array must not be empty');
  }

  // Use a single session for all operations
  const session = await mongoose.startSession();
  let isTransactionActive = false;

  try {
    await session.startTransaction();
    isTransactionActive = true;

    let created = 0;
    let updated = 0;
    const errors: string[] = [];
    const processedItems: any[] = [];

    // Pre-validate all items before processing
    console.log(`Starting bulk upsert for ${translations.length} translations`);

    for (let i = 0; i < translations.length; i++) {
      const item = translations[i];
      
      try {
        // Validate required fields
        if (!item.contentElement || !mongoose.Types.ObjectId.isValid(item.contentElement as string)) {
          throw new Error(`Invalid contentElement ID: ${item.contentElement}`);
        }

        if (!item.language || !mongoose.Types.ObjectId.isValid(item.language as string)) {
          throw new Error(`Invalid language ID: ${item.language}`);
        }

        if (!item.content) {
          throw new Error('Content is required');
        }

        // Convert string IDs to ObjectIds for consistency
        const contentElementId = new mongoose.Types.ObjectId(item.contentElement as string);
        const languageId = new mongoose.Types.ObjectId(item.language as string);

        // Check if content element and language exist (batch validation)
        const [elementExists, languageExists] = await Promise.all([
          ContentElementModel.exists({ _id: contentElementId }).session(session),
          LanguagesModel.exists({ _id: languageId }).session(session)
        ]);

        if (!elementExists) {
          throw new Error(`Content element with ID ${item.contentElement} not found`);
        }

        if (!languageExists) {
          throw new Error(`Language with ID ${item.language} not found`);
        }

        // Prepare the processed item
        processedItems.push({
          ...item,
          contentElement: contentElementId,
          language: languageId,
          index: i
        });

      } catch (validationError) {
        const errorMessage = `Item ${i + 1}: ${validationError.message}`;
        errors.push(errorMessage);
        console.error('Validation error:', errorMessage);
      }
    }

    // If there are validation errors, throw them immediately
    if (errors.length > 0) {
      throw new Error(`Validation failed for ${errors.length} items: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`);
    }

    // Process all valid items
    for (const processedItem of processedItems) {
      try {
        if (processedItem.id && mongoose.Types.ObjectId.isValid(processedItem.id)) {
          // Update existing translation by ID
          const updateResult = await ContentTranslationModel.findByIdAndUpdate(
            processedItem.id,
            { 
              $set: {
                content: processedItem.content,
                contentElement: processedItem.contentElement,
                language: processedItem.language,
                isActive: processedItem.isActive !== undefined ? processedItem.isActive : true,
                metadata: processedItem.metadata || {},
                updatedAt: new Date()
              }
            },
            { 
              runValidators: true, 
              new: true, 
              session,
              lean: true
            }
          );
          
          if (!updateResult) {
            throw new Error(`Translation with ID ${processedItem.id} not found for update`);
          }
          
          updated++;
        } else {
          // Check if translation already exists for this element and language
          const existingTranslation = await ContentTranslationModel.findOne({
            contentElement: processedItem.contentElement,
            language: processedItem.language
          }).session(session).lean();

          if (existingTranslation) {
            // Update existing translation
            await ContentTranslationModel.findByIdAndUpdate(
              existingTranslation._id,
              {
                $set: {
                  content: processedItem.content,
                  isActive: processedItem.isActive !== undefined ? processedItem.isActive : true,
                  metadata: processedItem.metadata || {},
                  updatedAt: new Date()
                }
              },
              { runValidators: true, session }
            );
            updated++;
          } else {
            // Create new translation
            const newTranslation = {
              content: processedItem.content,
              contentElement: processedItem.contentElement,
              language: processedItem.language,
              isActive: processedItem.isActive !== undefined ? processedItem.isActive : true,
              metadata: processedItem.metadata || {},
              createdAt: new Date(),
              updatedAt: new Date()
            };

            await ContentTranslationModel.create([newTranslation], { session });
            created++;
          }
        }

      } catch (itemError) {
        const errorMessage = `Item ${processedItem.index + 1}: ${itemError.message}`;
        errors.push(errorMessage);
        console.error('Processing error:', errorMessage);
      }
    }

    // Commit the transaction
    await session.commitTransaction();
    isTransactionActive = false;

    console.log(`Bulk upsert completed: ${created} created, ${updated} updated, ${errors.length} errors`);

    // Clear relevant caches after successful transaction
    try {
      const uniqueContentElements = [...new Set(processedItems.map(item => item.contentElement.toString()))];
      const uniqueLanguages = [...new Set(processedItems.map(item => item.language.toString()))];
      
      // Invalidate caches for affected content elements and languages
      const cacheKeys: string[] = [];
      uniqueContentElements.forEach(elementId => {
        cacheKeys.push(`translations:contentElement:${elementId}:true`);
        cacheKeys.push(`translations:contentElement:${elementId}:false`);
      });
      
      uniqueLanguages.forEach(languageId => {
        cacheKeys.push(`translations:language:${languageId}:true`);
        cacheKeys.push(`translations:language:${languageId}:false`);
      });

      if (cacheKeys.length > 0) {
        await redis.del(...cacheKeys).catch(cacheError => {
          console.error('Cache invalidation error (non-fatal):', cacheError);
        });
      }
    } catch (cacheError) {
      console.error('Cache cleanup error (non-fatal):', cacheError);
    }

    // Return results
    if (errors.length > 0) {
      return {
        success: false,
        message: `Processed ${processedItems.length} translations with ${errors.length} errors: ${created} created, ${updated} updated`,
        created,
        updated,
        errors
      };
    }

    return { 
      success: true, 
      message: `Successfully processed ${processedItems.length} translations: ${created} created, ${updated} updated`,
      created,
      updated
    };

  } catch (error) {
    if (isTransactionActive) {
      try {
        await session.abortTransaction();
        console.log('Transaction aborted due to error');
      } catch (abortError) {
        console.error('Error aborting transaction in bulkUpsertTranslations:', abortError);
      }
    }
    
    console.error('Bulk upsert failed:', error);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw AppError.database(`Bulk upsert failed: ${error.message}`);
    
  } finally {
    try {
      session.endSession();
    } catch (endError) {
      console.error('Error ending session in bulkUpsertTranslations:', endError);
    }
  }
}
}

export default new ContentTranslationService();