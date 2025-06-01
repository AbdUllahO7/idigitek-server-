import mongoose, { Schema } from 'mongoose';
import { ILanguages } from '../types/languages.types';

const languagesSchema = new Schema<ILanguages>(
    {
    language: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    languageID: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    isActive: {
        type: Boolean,
        default: false
    },
    websiteId: {
        type: Schema.Types.ObjectId,
        ref: 'WebSite',
        required: true,
        index: true
    },
    subSections: [{
        type: Schema.Types.ObjectId,
        ref: 'SubSections' 
    }]
    },
    {
        timestamps: true,
    }
);

// Create compound indexes for website and language/languageID to ensure uniqueness per website
languagesSchema.index({ websiteId: 1, languageID: 1 }, { unique: true });
languagesSchema.index({ websiteId: 1, language: 1 }, { unique: true });

const LanguageModel = mongoose.model<ILanguages>('Languages', languagesSchema);

export default LanguageModel;