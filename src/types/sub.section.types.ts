import { Document, Schema, Types } from 'mongoose';

export interface ICreateSubSection extends Document {
  name: string;
  description?: string;
  slug: string;
  isActive: boolean;
  order: number;
  isMain: boolean;
  sectionItem: Types.ObjectId;
  section?: Types.ObjectId; // New direct relation to section
  languages?: Types.ObjectId[];
  WebSiteId : Schema.Types.ObjectId,
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
  elements?: any[];
    contentCount?: number;
}

export interface IUpdateSubSection {
  name?: string;
  description?: string;
  slug?: string;
  isActive?: boolean;
  order?: number;
  isMain?: boolean;
  sectionItem?: Types.ObjectId;
  section?: Types.ObjectId; // New direct relation to section
  languages?: Types.ObjectId[];
  metadata?: Record<string, any>;
}