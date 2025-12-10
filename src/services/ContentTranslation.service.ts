import mongoose, { Types } from 'mongoose';
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
   * Get translation by ID
   * @param id The translation ID
   * @returns Promise with the translation
   */
  async getTranslationById(id: string): Promise<IContentTranslation> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AppError.validation('Invalid translation ID format');
      }

      const translation = await ContentTranslationModel.findLean({ _id: id })
        .populate('language')
        .populate('contentElement');

      if (!translation.length) {
        throw AppError.notFound(`Translation with ID ${id} not found`);
      }

      return translation[0];
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
      if (!Types.ObjectId.isValid(contentElementId)) {
        throw AppError.validation('Invalid content element ID format');
      }

      const query: any = { contentElement: contentElementId };
      if (activeOnly) query.isActive = true;

      const translations = await ContentTranslationModel.findLean(query)
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
      if (!Types.ObjectId.isValid(languageId)) {
        throw AppError.validation('Invalid language ID format');
      }

      const query: any = { language: languageId };
      if (activeOnly) query.isActive = true;

      const translations = await ContentTranslationModel.findLean(query)
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
      if (!Types.ObjectId.isValid(contentElementId) || !Types.ObjectId.isValid(languageId)) {
        throw AppError.validation('Invalid content element or language ID format');
      }

      const translation = await ContentTranslationModel.findLean({
        contentElement: contentElementId,
        language: languageId,
      })
        .populate('language')
        .populate('contentElement');

      return translation.length ? translation[0] : null;
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
            updatedAt: new Date()
          }
        },
        { 
          new: true, 
          runValidators: true, 
          lean: true,
          session
        }
      );

      if (!translation) {
        throw AppError.notFound(`Translation with ID ${id} not found`);
      }

      // Commit the transaction
      await session.commitTransaction();
      isTransactionActive = false;

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
   * Bulk create or update translations
   * @param translations Array of translation data
   * @returns Promise with success message and count
   */
  async bulkUpsertTranslations(translations: (ICreateContentTranslation & { id?: string })[]): 
    Promise<{ success: boolean; message: string; created: number; updated: number; errors?: string[] }> {
    
    // Validate the input array first
    if (!Array.isArray(translations) || translations.length === 0) {
      throw AppError.validation('Translations array must not be empty');
    }

    console.log(`🚀 Starting bulk upsert for ${translations.length} translations`);

    let session: mongoose.ClientSession | null = null;
    let isTransactionActive = false;

    try {
      // Create fresh session with explicit options
      session = await mongoose.startSession();
      
      // Start transaction with retry options
      const transactionOptions = {
        readPreference: 'primary',
        readConcern: { level: 'local' as const },
        writeConcern: { 
          w: 'majority' as const, 
          j: true,
          wtimeout: 10000 
        }
      };

      await session.withTransaction(async () => {
        isTransactionActive = true;
        
        let created = 0;
        let updated = 0;
        const errors: string[] = [];

        console.log(`📝 Processing ${translations.length} translations in transaction`);

        // Process translations in smaller batches to avoid session timeout
        const BATCH_SIZE = 50;
        const batches = [];
        
        for (let i = 0; i < translations.length; i += BATCH_SIZE) {
          batches.push(translations.slice(i, i + BATCH_SIZE));
        }

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} items)`);

          // Pre-validate and prepare batch
          const validItems: any[] = [];
          
          for (let i = 0; i < batch.length; i++) {
            const item = batch[i];
            const globalIndex = batchIndex * BATCH_SIZE + i;
            
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

              // Convert to ObjectIds
              const contentElementId = new mongoose.Types.ObjectId(item.contentElement as string);
              const languageId = new mongoose.Types.ObjectId(item.language as string);

              validItems.push({
                ...item,
                contentElement: contentElementId,
                language: languageId,
                originalIndex: globalIndex
              });

            } catch (validationError) {
              const errorMessage = `Item ${globalIndex + 1}: ${validationError.message}`;
              errors.push(errorMessage);
              console.error('❌ Validation error:', errorMessage);
            }
          }

          // Skip this batch if no valid items
          if (validItems.length === 0) {
            console.log(`⏭️ Skipping batch ${batchIndex + 1} - no valid items`);
            continue;
          }

          // Batch validate references exist
          const contentElementIds = [...new Set(validItems.map(item => item.contentElement.toString()))];
          const languageIds = [...new Set(validItems.map(item => item.language.toString()))];

          const [existingElements, existingLanguages] = await Promise.all([
            ContentElementModel.find({ _id: { $in: contentElementIds } }, '_id').session(session).lean(),
            LanguagesModel.find({ _id: { $in: languageIds } }, '_id').session(session).lean()
          ]);

          const existingElementIds = new Set(existingElements.map(el => el._id.toString()));
          const existingLanguageIds = new Set(existingLanguages.map(lang => lang._id.toString()));

          // Filter out items with non-existent references
          const itemsWithValidRefs = validItems.filter(item => {
            const elementExists = existingElementIds.has(item.contentElement.toString());
            const languageExists = existingLanguageIds.has(item.language.toString());
            
            if (!elementExists) {
              errors.push(`Item ${item.originalIndex + 1}: Content element ${item.contentElement} not found`);
            }
            if (!languageExists) {
              errors.push(`Item ${item.originalIndex + 1}: Language ${item.language} not found`);
            }
            
            return elementExists && languageExists;
          });

          console.log(`✅ Batch ${batchIndex + 1}: ${itemsWithValidRefs.length}/${validItems.length} items have valid references`);

          // Process each valid item
          for (const item of itemsWithValidRefs) {
            try {
              if (item.id && mongoose.Types.ObjectId.isValid(item.id)) {
                // Update by ID
                const updateResult = await ContentTranslationModel.findByIdAndUpdate(
                  item.id,
                  { 
                    $set: {
                      content: item.content,
                      contentElement: item.contentElement,
                      language: item.language,
                      isActive: item.isActive !== undefined ? item.isActive : true,
                      metadata: item.metadata || {},
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
                  throw new Error(`Translation with ID ${item.id} not found for update`);
                }
                
                updated++;
                console.log(`📝 Updated translation ${item.id}`);
              } else {
                // Upsert by contentElement + language
                const upsertResult = await ContentTranslationModel.findOneAndUpdate(
                  {
                    contentElement: item.contentElement,
                    language: item.language
                  },
                  {
                    $set: {
                      content: item.content,
                      isActive: item.isActive !== undefined ? item.isActive : true,
                      metadata: item.metadata || {},
                      updatedAt: new Date()
                    },
                    $setOnInsert: {
                      contentElement: item.contentElement,
                      language: item.language,
                      createdAt: new Date()
                    }
                  },
                  {
                    upsert: true,
                    new: true,
                    runValidators: true,
                    session,
                    lean: true
                  }
                );

                if (upsertResult) {
                  // Check if it was created or updated by comparing timestamps
                  const wasCreated = upsertResult.createdAt && 
                    Math.abs(upsertResult.createdAt.getTime() - upsertResult.updatedAt.getTime()) < 1000;
                  
                  if (wasCreated) {
                    created++;
                    console.log(`✨ Created translation for element ${item.contentElement} + language ${item.language}`);
                  } else {
                    updated++;
                    console.log(`📝 Updated translation for element ${item.contentElement} + language ${item.language}`);
                  }
                }
              }

            } catch (itemError) {
              const errorMessage = `Item ${item.originalIndex + 1}: ${itemError.message}`;
              errors.push(errorMessage);
              console.error('❌ Processing error:', errorMessage);
            }
          }
        }

        // Store results for access outside transaction
        (session as any)._bulkResults = { created, updated, errors };
        
        console.log(`📊 Batch processing completed: ${created} created, ${updated} updated, ${errors.length} errors`);
        
      }, transactionOptions);

      isTransactionActive = false;
      
      // Get results from session
      const results = (session as any)._bulkResults || { created: 0, updated: 0, errors: [] };
      const { created, updated, errors } = results;

      console.log(`✅ Transaction completed successfully: ${created} created, ${updated} updated`);

      // Return results
      const totalProcessed = created + updated;
      
      if (errors.length > 0) {
        return {
          success: totalProcessed > 0,
          message: `Processed ${totalProcessed} translations with ${errors.length} errors: ${created} created, ${updated} updated`,
          created,
          updated,
          errors
        };
      }

      return { 
        success: true, 
        message: `Successfully processed ${totalProcessed} translations: ${created} created, ${updated} updated`,
        created,
        updated
      };

    } catch (error) {
      console.error('💥 Bulk upsert failed:', {
        name: error.name,
        message: error.message,
        code: error.code,
        transactionActive: isTransactionActive
      });
      
      if (error instanceof AppError) {
        throw error;
      }
      
      // Create more specific error messages
      if (error.message?.includes('transaction number')) {
        throw AppError.database('Transaction conflict detected. Please retry the operation.');
      }
      
      if (error.message?.includes('session')) {
        throw AppError.database('Database session error. Please retry the operation.');
      }
      
      throw AppError.database(`Bulk upsert failed: ${error.message}`);
      
    } finally {
      // Always clean up session
      if (session) {
        try {
          await session.endSession();
          console.log('🧹 Session ended successfully');
        } catch (endError) {
          console.error('⚠️ Error ending session:', endError.message);
        }
      }
    }
  }
}

export default new ContentTranslationService();