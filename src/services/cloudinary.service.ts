import { v2 as cloudinary } from 'cloudinary';
import { AppError } from '../middleware/errorHandler.middleware';

class CloudinaryService {
  constructor() {
    // Cloudinary is configured via environment variables (CLOUDINARY_URL)
    // This ensures cloudinary is properly initialized
    if (!process.env.CLOUDINARY_URL) {
      console.warn('Warning: CLOUDINARY_URL is not set. Image uploads may fail.');
    }
  }

  /**
   * Extract public ID from a Cloudinary URL
   * @param url Cloudinary URL
   * @returns Public ID or null if URL is invalid
   */
  getPublicIdFromUrl(url: string): string | null {
    if (!url) return null;
    
    try {
      // Extract the public ID from the URL
      // Example URL: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/public_id.jpg
      const urlParts = url.split('/');
      // Find the upload part
      const uploadIndex = urlParts.findIndex(part => part === 'upload');
      
      if (uploadIndex === -1 || uploadIndex + 2 >= urlParts.length) {
        return null;
      }
      
      // Get everything after the version (v1234567890)
      const parts = urlParts.slice(uploadIndex + 2);
      // Join them back together
      let publicId = parts.join('/');
      
      // Remove file extension if present
      const lastDotIndex = publicId.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        publicId = publicId.substring(0, lastDotIndex);
      }
      
      return publicId;
    } catch (error) {
      console.error('Error extracting public ID from URL:', error);
      return null;
    }
  }

  /**
   * Upload an image to Cloudinary
   * @param filePath Path to the image file
   * @returns Promise with the upload result
   */
  async uploadImage(filePath: string): Promise<any> {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        resource_type: 'image',
        folder: 'content-elements',
      });
      return result;
    } catch (error) {
      throw AppError.badRequest('Failed to upload image to Cloudinary', error);
    }
  }

  /**
   * Delete an image from Cloudinary
   * @param publicId The public ID of the image
   * @returns Promise with the deletion result
   */
  async deleteImage(publicId: string): Promise<any> {
    try {
      return await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      throw AppError.badRequest('Failed to delete image from Cloudinary', error);
    }
  }

  /**
   * Upload a raw file (documents, etc.) to Cloudinary
   * @param filePath Path to the file
   * @param options Additional Cloudinary options
   * @returns Promise with upload result
   */
  async uploadRawFile(filePath: string, options: any = {}): Promise<any> {
    try {
      const defaultOptions = {
        resource_type: 'raw',
        folder: 'content-files',
        use_filename: true,
        unique_filename: true
      };

      const uploadOptions = { ...defaultOptions, ...options };
      const result = await cloudinary.uploader.upload(filePath, uploadOptions);
      
      return result;
    } catch (error) {
      console.error('Cloudinary file upload error:', error);
      throw AppError.badRequest('Failed to upload file to Cloudinary', error);
    }
  }


  
  /**
   * Delete a raw file from Cloudinary
   * @param publicId The public ID of the file to delete
   * @returns Promise with deletion result
   */
  async deleteRawFile(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw'
      });
      
      return result;
    } catch (error) {
      console.error('Cloudinary file deletion error:', error);
      throw AppError.badRequest('Failed to delete file from Cloudinary', error);
    }
  }

  /**
   * Generate a signed URL for secure file access
   * @param publicId The public ID of the file
   * @param options Additional options for URL generation
   * @returns Signed URL string
   */
  generateSignedUrl(publicId: string, options: any = {}): string {
    try {
      const defaultOptions = {
        resource_type: 'raw',
        sign_url: true,
        expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      };

      const urlOptions = { ...defaultOptions, ...options };
      
      return cloudinary.url(publicId, urlOptions);
    } catch (error) {
      console.error('Cloudinary signed URL generation error:', error);
      throw AppError.badRequest('Failed to generate signed URL', error);
    }
  }

  /**
   * Get file information from Cloudinary
   * @param publicId The public ID of the file
   * @param resourceType The resource type ('image' or 'raw')
   * @returns Promise with file information
   */
  async getFileInfo(publicId: string, resourceType: 'image' | 'raw' = 'image'): Promise<any> {
    try {
      const result = await cloudinary.api.resource(publicId, {
        resource_type: resourceType
      });
      
      return result;
    } catch (error) {
      console.error('Cloudinary get file info error:', error);
      throw AppError.badRequest('Failed to get file information from Cloudinary', error);
    }
  }

  /**
   * Search for files in Cloudinary
   * @param query Search query
   * @param options Additional search options
   * @returns Promise with search results
   */
  async searchFiles(query: string, options: any = {}): Promise<any> {
    try {
      const result = await cloudinary.search
        .expression(query)
        .with_field('context')
        .with_field('tags')
        .max_results(options.max_results || 30)
        .execute();
      
      return result;
    } catch (error) {
      console.error('Cloudinary search error:', error);
      throw AppError.badRequest('Failed to search files in Cloudinary', error);
    }
  }
}

export default new CloudinaryService();