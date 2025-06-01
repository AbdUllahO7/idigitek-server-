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
}

export default new CloudinaryService();