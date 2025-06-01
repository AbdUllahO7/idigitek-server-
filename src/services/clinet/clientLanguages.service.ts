import mongoose from "mongoose";
import { AppError } from "../../middleware/errorHandler.middleware";
import LanguageModel from "../../models/languages.model";


export class ClientLanguagesService {
    async getLanguagesByWebsite(websiteId: string) {
        try {
            if (!mongoose.Types.ObjectId.isValid(websiteId)) {
                throw AppError.validation('Invalid website ID format');
            }
            
            const languages = await LanguageModel.find({ websiteId }).populate('subSections');
            return languages;
            } catch (error) {
            if (error instanceof AppError) throw error;
            throw AppError.database('Failed to retrieve languages for website', error);
            }
        }
}