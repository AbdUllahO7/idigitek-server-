import { Request, Response } from 'express';
import { asyncHandler } from "../../middleware/errorHandler.middleware";
import { ClientLanguagesService } from '../../services/clinet/clientLanguages.service';
import { sendSuccess } from "../../utils/responseHandler";

const clientLanguageService = new ClientLanguagesService();


export class ClientLanguagesController {
    getLanguagesByWebsite = asyncHandler(async (req: Request, res: Response) => {
        const websiteId = req.params.websiteId;
        
        const languages = await clientLanguageService.getLanguagesByWebsite(websiteId);
        
        sendSuccess(res, languages, `Languages for website ${websiteId} retrieved successfully`);
    });
}

export default new ClientLanguagesController();