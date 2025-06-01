import { Request, Response } from 'express';
import { AppError, asyncHandler } from "../../middleware/errorHandler.middleware";
import { sendSuccess } from '../../utils/responseHandler';
import { ClientSectionService } from '../../services/clinet/clientSection.service';

export class ClientSectionController {
    private clientSectionService: ClientSectionService;

    constructor() {
        this.clientSectionService = new ClientSectionService();
    }

    getSectionWithContent = asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const { languageId } = req.query;

        if (!id) {
            throw AppError.badRequest('Section ID is required');
        }

        if (!languageId) {
            throw AppError.badRequest('Language ID is required');
        }

        const section = await this.clientSectionService.getSectionWithContent(id, languageId as string);

        if (!section) {
            throw AppError.notFound('Section not found');
        }

        return sendSuccess(res, section, 'Section with content retrieved successfully');
    });

    getSectionsWithDataByWebsiteId = asyncHandler(async (req: Request, res: Response) => {
        const { websiteId } = req.params;
        const { includeInactive, languageId } = req.query;

        if (!websiteId) {
            throw AppError.badRequest('Website ID is required');
        }

        const sections = await this.clientSectionService.getSectionsWithDataByWebsiteId(
            websiteId,
            includeInactive === 'true',
            languageId as string
        );

        if (!sections || sections.length === 0) {
            throw AppError.notFound('No sections found for the given website');
        }

        return sendSuccess(res, sections, 'Sections with content retrieved successfully');
    });
}

export default ClientSectionController;