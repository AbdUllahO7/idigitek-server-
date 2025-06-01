import mongoose from 'mongoose';
import SubSectionModel from '../models/subSections.model';
import { IContentElement, ICreateContentElement, IUpdateContentElement } from '../types/ContentElement.type';
import ContentElementModel from '../models/ContentElement.model';
import ContentTranslationModel from '../models/ContentTranslation.model';
import cloudinaryService from './cloudinary.service';
import { AppError } from '../middleware/errorHandler.middleware';
import { File } from 'multer';

class ContentElementService {
  /**
   * Create a new content element
   * @param data The content element data to create
   * @returns Promise with the created content element
   */
    async createContentElement(data: ICreateContentElement): Promise<IContentElement> {
      try {
        // Validate parent subsection exists
        const parentExists = await SubSectionModel.exists({ _id: data.parent });
        if (!parentExists) {
          throw AppError.notFound(`Parent subsection with ID ${data.parent} not found`);
        }

        // Create the content element
        const contentElement = new ContentElementModel(data);
        return await contentElement.save();
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw AppError.database('Failed to create content element', error);
      }
    }

    /**
 * Upload an image for a content element
 * @param id Content element ID
 * @param file The image file to upload
 * @returns Promise with the updated content element
 */
    async uploadElementImage(id: string, file: File): Promise<IContentElement> {
      try {
        // Validate ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
          throw AppError.validation('Invalid content element ID format');
        }

        // Find the content element
        const contentElement = await ContentElementModel.findById(id);
        if (!contentElement) {
          throw AppError.notFound(`Content element with ID ${id} not found`);
        }

        // Check if element type is image
        if (contentElement.type !== 'image') {
          throw AppError.badRequest('Content element type must be "image" to upload an image');
        }

        // Upload to Cloudinary
        const result = await cloudinaryService.uploadImage(file.path);
        
        // Update content element with image URL
        contentElement.imageUrl = result.secure_url;
        // Optional: store additional cloudinary data in metadata
        if (!contentElement.metadata) contentElement.metadata = {};
        contentElement.metadata.cloudinaryId = result.public_id;
        contentElement.metadata.width = result.width;
        contentElement.metadata.height = result.height;
        
        // Save and return updated content element
        return await contentElement.save();
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw AppError.database('Failed to upload image for content element', error);
      }
    }

  /**
   * Get content element by ID
   * @param id The content element ID
   * @param populateTranslations Whether to populate translations
   * @returns Promise with the content element
   */
    async getContentElementById(id: string, populateTranslations: boolean = false): Promise<IContentElement> {
      try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          throw AppError.validation('Invalid content element ID format');
        }

        const query = ContentElementModel.findById(id);
        
        const contentElement = await query.exec();
        
        if (!contentElement) {
          throw AppError.notFound(`Content element with ID ${id} not found`);
        }

        // If requested, get translations in a separate query
        if (populateTranslations) {
          const translations = await ContentTranslationModel.find({ contentElement: id })
            .populate('language');
          
          // Add translations to the result (use any to bypass TypeScript interface limitation)
          (contentElement as any).translations = translations;
        }
        
        return contentElement;
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw AppError.database('Failed to retrieve content element', error);
      }
    }

  /**
   * Get all content elements for a subsection
   * @param subsectionId The subsection ID
   * @param activeOnly Whether to return only active elements
   * @param populateTranslations Whether to populate translations
   * @returns Promise with array of content elements
   */
    async getContentElementsBySubsection(
      subsectionId: string, 
      activeOnly: boolean = true,
      populateTranslations: boolean = false
    ): Promise<IContentElement[]> {
      try {
        if (!mongoose.Types.ObjectId.isValid(subsectionId)) {
          throw AppError.validation('Invalid subsection ID format');
        }

        // Check if subsection exists
        const subsectionExists = await SubSectionModel.exists({ _id: subsectionId });
        if (!subsectionExists) {
          throw AppError.notFound(`Subsection with ID ${subsectionId} not found`);
        }

        // Build query
        const query: any = { parent: subsectionId };
        if (activeOnly) {
          query.isActive = true;
        }

        // Get content elements
        const contentElements = await ContentElementModel.find(query)
          .sort({ order: 1, createdAt: 1 });

        // If requested, get translations for all elements
        if (populateTranslations && contentElements.length > 0) {
          const elementIds = contentElements.map(element => element._id);
          
          const translations = await ContentTranslationModel.find({
            contentElement: { $in: elementIds }
          }).populate('language');

          // Group translations by content element ID
          const translationsByElement = translations.reduce((acc, translation) => {
            const elementId = translation.contentElement.toString();
            if (!acc[elementId]) {
              acc[elementId] = [];
            }
            acc[elementId].push(translation);
            return acc;
          }, {} as { [key: string]: any[] });

          // Add translations to each content element
          contentElements.forEach(element => {
            const elementId = element._id.toString();
            (element as any).translations = translationsByElement[elementId] || [];
          });
        }

        return contentElements;
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw AppError.database('Failed to retrieve content elements', error);
      }
    }

  /**
   * Update content element by ID
   * @param id The content element ID
   * @param updateData The data to update
   * @returns Promise with the updated content element
   */
    async updateContentElement(id: string, updateData: IUpdateContentElement): Promise<IContentElement> {
      try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          throw AppError.validation('Invalid content element ID format');
        }

        // If parent is being updated, validate it exists
        if (updateData.parent && !mongoose.Types.ObjectId.isValid(updateData.parent.toString())) {
          throw AppError.validation('Invalid parent subsection ID format');
        }

        if (updateData.parent) {
          const parentExists = await SubSectionModel.exists({ _id: updateData.parent });
          if (!parentExists) {
            throw AppError.notFound(`Parent subsection with ID ${updateData.parent} not found`);
          }
        }

        // Update the content element
        const contentElement = await ContentElementModel.findByIdAndUpdate(
          id,
          { $set: updateData },
          { new: true, runValidators: true }
        );
        
        if (!contentElement) {
          throw AppError.notFound(`Content element with ID ${id} not found`);
        }
        return contentElement;
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw AppError.database('Failed to update content element', error);
      }
    }

  /**
   * Delete content element by ID
   * @param id The content element ID
   * @param hardDelete Whether to permanently delete
   * @returns Promise with the operation result
   */
    async deleteContentElement(id: string, hardDelete: boolean = false): Promise<{ success: boolean; message: string }> {
      try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          throw AppError.validation('Invalid content element ID format');
        }
    
        const contentElement = await ContentElementModel.findById(id);
        if (!contentElement) {
          throw AppError.notFound(`Content element with ID ${id} not found`);
        }
    
        // Check if this is an image type with Cloudinary image
        if (contentElement.type === 'image' && 
            contentElement.metadata?.cloudinaryId &&
            hardDelete) {
          try {
            // Delete the image from Cloudinary
            await cloudinaryService.deleteImage(contentElement.metadata.cloudinaryId);
          } catch (error) {
            console.error('Failed to delete image from Cloudinary:', error);
            // Continue with deletion even if Cloudinary delete fails
          }
        }
    
        if (hardDelete) {
          // First delete all translations for this element
          await ContentTranslationModel.deleteMany({ contentElement: id });
          
          // Then delete the element
          await ContentElementModel.findByIdAndDelete(id);
          return { success: true, message: 'Content element and its translations deleted successfully' };
        } else {
          // Soft delete - just mark as inactive
          contentElement.isActive = false;
          await contentElement.save();
          
          // Also mark all translations as inactive
          await ContentTranslationModel.updateMany(
            { contentElement: id },
            { isActive: false }
          );
          
          return { success: true, message: 'Content element and its translations deactivated successfully' };
        }
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw AppError.database('Failed to delete content element', error);
      }
    }

  /**
   * Bulk update content element order
   * @param elements Array of { id, order } objects
   * @returns Promise with success message
   */
    async updateElementsOrder(elements: { id: string; order: number }[]): Promise<{ success: boolean; message: string }> {
      try {
        const bulkOps = elements.map(element => ({
          updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(element.id) },
            update: { $set: { order: element.order } }
          }
        }));

        if (bulkOps.length > 0) {
          await ContentElementModel.bulkWrite(bulkOps);
        }

        return { success: true, message: `Updated order for ${elements.length} content elements` };
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw AppError.database('Failed to update content elements order', error);
      }
    }



  


}

export default new ContentElementService();