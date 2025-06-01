import { Document, Types } from 'mongoose';

export interface ILanguages extends Document {
    language: string;
    languageID: string;
    isActive: boolean;
    websiteId: Types.ObjectId; // Reference to the website
    subSections: Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

export interface ICreateLanguage {
    language: string;
    languageID: string;
    isActive?: boolean;
    websiteId: string;
    subSections?: Types.ObjectId[];
}

export interface IUpdateLanguage {
    language?: string;
    languageID?: string;
    isActive?: boolean;
    websiteId?: string;
    subSections?: Types.ObjectId[];
}