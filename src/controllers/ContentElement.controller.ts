import { Request, Response } from 'express';
import { sendSuccess } from '../utils/responseHandler';
import { AppError, asyncHandler } from '../middleware/errorHandler.middleware';
import mongoose from 'mongoose';
import ContentElementService from '../services/ContentElement.service';
import fs from 'fs-extra';
import { File } from 'multer';

class ContentElementController {
  createContentElement = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const contentElement = await ContentElementService.createContentElement(req.body);
    sendSuccess(res, contentElement, 'Content element created successfully', 201);
  });

  uploadElementImage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const file = req.file as File;

    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw AppError.validation('Invalid content element ID format');
      }

      if (!file) {
        throw AppError.badRequest('No image file provided');
      }

      const updatedElement = await ContentElementService.uploadElementImage(
        req.params.id,
        file
      );

      sendSuccess(res, updatedElement, 'Content element image uploaded successfully');
    } finally {
      if (file?.path) {
        fs.remove(file.path).catch(err =>
          console.error('Error removing temporary file:', err)
        );
      }
    }
  });

  getContentElementById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const populateTranslations = req.query.translations === 'true';
    const contentElement = await ContentElementService.getContentElementById(
      req.params.id,
      populateTranslations
    );

    sendSuccess(res, contentElement, 'Content element retrieved successfully');
  });

  getContentElementsBySubsection = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeOnly = req.query.activeOnly !== 'false'; // Default true
    const populateTranslations = req.query.translations === 'true';

    const contentElements = await ContentElementService.getContentElementsBySubsection(
      req.params.subsectionId,
      activeOnly,
      populateTranslations
    );

    sendSuccess(res, contentElements, 'Content elements retrieved successfully');
  });

  updateContentElement = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const contentElement = await ContentElementService.updateContentElement(
      req.params.id,
      req.body
    );

    sendSuccess(res, contentElement, 'Content element updated successfully');
  });

  deleteContentElement = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const hardDelete = req.query.hardDelete === 'true';

    const result = await ContentElementService.deleteContentElement(
      req.params.id,
      hardDelete
    );

    sendSuccess(res, result, result.message);
  });

  updateElementsOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const elements: { id: string; order: number }[] = req.body.elements;

    if (!elements || !Array.isArray(elements) || elements.length === 0) {
      throw AppError.badRequest('Valid elements array is required');
    }

    elements.forEach(element => {
      if (!element.id || !mongoose.Types.ObjectId.isValid(element.id)) {
        throw AppError.validation(`Invalid element ID: ${element.id}`);
      }
      if (typeof element.order !== 'number') {
        throw AppError.validation(`Order must be a number for element ID: ${element.id}`);
      }
    });

    const result = await ContentElementService.updateElementsOrder(elements);

    sendSuccess(res, result, result.message);
  });
}

export default new ContentElementController();
