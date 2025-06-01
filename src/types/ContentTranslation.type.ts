import { Document, Schema } from 'mongoose';

export interface IContentTranslation extends Document {
  content: string;
  language: Schema.Types.ObjectId | string;
  contentElement: Schema.Types.ObjectId | string;
  isActive: boolean;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateContentTranslation {
  content: string;
  language: Schema.Types.ObjectId | string;
  contentElement: Schema.Types.ObjectId | string;
  isActive?: boolean;
  metadata?: any;
}

export interface IUpdateContentTranslation {
  content?: string;
  language?: Schema.Types.ObjectId | string;
  contentElement?: Schema.Types.ObjectId | string;
  isActive?: boolean;
  metadata?: any;
}