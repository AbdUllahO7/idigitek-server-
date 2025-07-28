import mongoose, { Types } from 'mongoose';
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
      // Validate parent subsection exists (use lean for performance)
      const parentExists = await SubSectionModel.exists({ _id: data.parent }).lean();
      if (!parentExists) {
        throw AppError.notFound(`Parent subsection with ID ${data.parent} not found`);
      }

      // Create and save content element using lean-like efficiency
      const contentElement = await ContentElementModel.create(data);
      return contentElement;
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
      if (!Types.ObjectId.isValid(id)) {
        throw AppError.validation('Invalid content element ID format');
      }

      // Find content element with lean for performance
      const contentElement = await ContentElementModel.findById(id).lean();
      if (!contentElement) {
        throw AppError.notFound(`Content element with ID ${id} not found`);
      }

      // Check if element type is image
      if (contentElement.type !== 'image') {
        throw AppError.badRequest('Content element type must be "image" to upload an image');
      }

      // Upload to Cloudinary
      const result = await cloudinaryService.uploadImage(file.path);

      // Update content element with image URL and metadata
      const updatedElement = await ContentElementModel.findByIdAndUpdate(
        id,
        {
          $set: {
            imageUrl: result.secure_url,
            'metadata.cloudinaryId': result.public_id,
            'metadata.width': result.width,
            'metadata.height': result.height,
          },
        },
        { new: true, runValidators: true }
      );

      if (!updatedElement) {
        throw AppError.notFound(`Content element with ID ${id} not found after update`);
      }

      return updatedElement;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to upload image for content element', error);
    }
  }

  /**
   * Upload a file for a content element
   * @param id Content element ID
   * @param file The file to upload
   * @returns Promise with the updated content element
   */
  async uploadElementFile(id: string, file: File): Promise<IContentElement> {
    try {
      // Validate ID
      if (!Types.ObjectId.isValid(id)) {
        throw AppError.validation('Invalid content element ID format');
      }

      // Find content element with lean
      const contentElement = await ContentElementModel.findById(id).lean();
      if (!contentElement) {
        throw AppError.notFound(`Content element with ID ${id} not found`);
      }

      // Check if element type is file
      if (contentElement.type !== 'file') {
        throw AppError.badRequest('Content element type must be "file" to upload a file');
      }

      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
      ];
      if (!allowedTypes.includes(file.mimetype)) {
        throw AppError.badRequest('File type not allowed. Supported types: PDF, DOC, DOCX, TXT, XLS, XLSX, CSV');
      }

      // Validate file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw AppError.badRequest('File size must be less than 5MB');
      }

      // Upload to Cloudinary
      const result = await cloudinaryService.uploadRawFile(file.path, {
        resource_type: 'raw',
        public_id: `files/${Date.now()}_${file.originalname}`,
        use_filename: true,
        unique_filename: false,
      });

      // Update content element with file information
      const updatedElement = await ContentElementModel.findByIdAndUpdate(
        id,
        {
          $set: {
            fileUrl: result.secure_url,
            fileName: file.originalname,
            fileSize: file.size,
            fileMimeType: file.mimetype,
            'metadata.cloudinaryId': result.public_id,
            'metadata.resourceType': result.resource_type,
          },
        },
        { new: true, runValidators: true }
      );

      if (!updatedElement) {
        throw AppError.notFound(`Content element with ID ${id} not found after update`);
      }

      return updatedElement;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to upload file for content element', error);
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
      if (!Types.ObjectId.isValid(id)) {
        throw AppError.validation('Invalid content element ID format');
      }

      // Use lean for faster queries
      let query = ContentElementModel.findById(id).lean();
      let contentElement = await query.exec();

      if (!contentElement) {
        throw AppError.notFound(`Content element with ID ${id} not found`);
      }

      // Populate translations if requested
      if (populateTranslations) {
        const translations = await ContentTranslationModel.find({ contentElement: id })
          .populate('language')
          .lean();
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
      if (!Types.ObjectId.isValid(subsectionId)) {
        throw AppError.validation('Invalid subsection ID format');
      }

      // Validate subsection exists (lean)
      const subsectionExists = await SubSectionModel.exists({ _id: subsectionId }).lean();
      if (!subsectionExists) {
        throw AppError.notFound(`Subsection with ID ${subsectionId} not found`);
      }

      // Build query with lean
      const query: any = { parent: subsectionId };
      if (activeOnly) {
        query.isActive = true;
      }

      // Use findLean static method for performance
      let contentElements = await ContentElementModel.findLean(query).sort({ order: 1, createdAt: 1 });

      // Populate translations if requested
      if (populateTranslations && contentElements.length > 0) {
        const elementIds = contentElements.map((element) => element._id);
        const translations = await ContentTranslationModel.find({
          contentElement: { $in: elementIds },
        })
          .populate('language')
          .lean();

        // Group translations by content element ID
        const translationsByElement = translations.reduce(
          (acc, translation) => {
            const elementId = translation.contentElement.toString();
            acc[elementId] = acc[elementId] || [];
            acc[elementId].push(translation);
            return acc;
          },
          {} as { [key: string]: any[] }
        );

        // Add translations to each content element
        contentElements = contentElements.map((element) => ({
          ...element,
          translations: translationsByElement[element._id.toString()] || [],
        }));
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
      if (!Types.ObjectId.isValid(id)) {
        throw AppError.validation('Invalid content element ID format');
      }

      // Validate parent if provided
      if (updateData.parent) {
        if (!Types.ObjectId.isValid(updateData.parent.toString())) {
          throw AppError.validation('Invalid parent subsection ID format');
        }
        const parentExists = await SubSectionModel.exists({ _id: updateData.parent }).lean();
        if (!parentExists) {
          throw AppError.notFound(`Parent subsection with ID ${updateData.parent} not found`);
        }
      }

      // Update with lean-like efficiency
      const contentElement = await ContentElementModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true, lean: true }
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
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!Types.ObjectId.isValid(id)) {
        throw AppError.validation('Invalid content element ID format');
      }

      const contentElement = await ContentElementModel.findById(id).lean();
      if (!contentElement) {
        throw AppError.notFound(`Content element with ID ${id} not found`);
      }

      // Handle Cloudinary deletions for hard delete
      if (hardDelete && contentElement.metadata?.cloudinaryId) {
        try {
          if (contentElement.type === 'image') {
            await cloudinaryService.deleteImage(contentElement.metadata.cloudinaryId);
          } else if (contentElement.type === 'file') {
            await cloudinaryService.deleteRawFile(contentElement.metadata.cloudinaryId);
          }
        } catch (error) {
          console.error('Failed to delete from Cloudinary:', error);
          // Continue with deletion to avoid blocking
        }
      }

      if (hardDelete) {
        // Delete translations and content element in transaction
        await ContentTranslationModel.deleteMany({ contentElement: id }).session(session);
        await ContentElementModel.findByIdAndDelete(id).session(session);
        await session.commitTransaction();
        return { success: true, message: 'Content element and its translations deleted successfully' };
      } else {
        // Soft delete in transaction
        await ContentElementModel.findByIdAndUpdate(id, { $set: { isActive: false } }).session(session);
        await ContentTranslationModel.updateMany(
          { contentElement: id },
          { $set: { isActive: false } }
        ).session(session);
        await session.commitTransaction();
        return { success: true, message: 'Content element and its translations deactivated successfully' };
      }
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to delete content element', error);
    } finally {
      session.endSession();
    }
  }

  /**
   * Bulk update content element order
   * @param elements Array of { id, order } objects
   * @returns Promise with success message
   */
  async updateElementsOrder(elements: { id: string; order: number }[]): Promise<{ success: boolean; message: string }> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate IDs
      const invalidIds = elements.filter((element) => !Types.ObjectId.isValid(element.id));
      if (invalidIds.length > 0) {
        throw AppError.validation('Invalid content element IDs: ' + invalidIds.map((e) => e.id).join(', '));
      }

      // Prepare bulk operations
      const bulkOps = elements.map((element) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(element.id) },
          update: { $set: { order: element.order } },
        },
      }));

      if (bulkOps.length > 0) {
        const result = await ContentElementModel.bulkWrite(bulkOps, { session });
        if (result.matchedCount < elements.length) {
          throw AppError.notFound('One or more content elements not found');
        }
      }

      await session.commitTransaction();
      return { success: true, message: `Updated order for ${elements.length} content elements` };
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to update content elements order', error);
    } finally {
      session.endSession();
    }
  }
}

export default new ContentElementService();