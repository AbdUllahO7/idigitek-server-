import { Request, Response } from 'express';
import { sendSuccess } from '../utils/responseHandler';
import cloudinaryService from '../services/cloudinary.service';
import { AppError, asyncHandler } from '../middleware/errorHandler.middleware';
import { File } from 'multer';

class UploadController {
  /**
   * Upload a single image
   * @route POST /api/uploads/image
   */
  uploadImage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw AppError.badRequest('No image file provided');
    }

    // File has been uploaded to Cloudinary by the middleware
    // req.file contains the uploaded file information including the URL
    const imageUrl = (req.file as any).path;
    const publicId = (req.file as any).filename;

    sendSuccess(
      res, 
      { 
        url: imageUrl, 
        publicId 
      }, 
      'Image uploaded successfully', 
      201
    );
  });

  /**
   * Upload multiple images
   * @route POST /api/uploads/images
   */
  uploadImages = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
      throw AppError.badRequest('No image files provided');
    }

    // Files have been uploaded to Cloudinary by the middleware
    const files = req.files as File;
    const uploadedImages = files.map(file => ({
      url: file.path,
      publicId: file.filename
    }));

    sendSuccess(
      res, 
      uploadedImages, 
      `Successfully uploaded ${uploadedImages.length} images`, 
      201
    );
  });

  /**
   * Delete an image from Cloudinary
   * @route DELETE /api/uploads/image/:publicId
   */
  deleteImage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { publicId } = req.params;

    if (!publicId) {
      throw AppError.badRequest('Public ID is required');
    }

    const deleted = await cloudinaryService.deleteImage(publicId);

    if (!deleted) {
      throw AppError.badRequest('Failed to delete image');
    }

    sendSuccess(
      res,
      { publicId },
      'Image deleted successfully'
    );
  });
}

export default new UploadController();