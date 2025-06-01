import mongoose from "mongoose";

// Update in types/ContentElement.type.ts
export interface IContentElement {
  _id: mongoose.Types.ObjectId;
  name: string;
  type: 'text' | 'heading' |'array' | 'paragraph' | 'list' | 'image' | 'video' | 'link' | 'custom' | 'badge' | 'textarea';
  defaultContent?: string;
  imageUrl?: string; // Add this field
  isActive: boolean;
  metadata?: any;
  order: number;
  parent: mongoose.Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
  translations : any[],
}

export interface ICreateContentElement {
  name: string;
  type: string;
  defaultContent?: string;
  imageUrl?: string; // Add this field
  isActive?: boolean;
  metadata?: any;
  order?: number;
  parent: mongoose.Types.ObjectId | string;
}

export interface IUpdateContentElement {
  name?: string;
  type?: string;
  defaultContent?: string;
  imageUrl?: string; // Add this field
  isActive?: boolean;
  metadata?: any;
  order?: number;
  parent?: mongoose.Types.ObjectId | string;
}