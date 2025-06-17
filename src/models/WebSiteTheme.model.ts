// backend/models/WebSiteTheme.model.ts

import mongoose, { Schema, Types } from 'mongoose';

// Define the TypeScript interface for WebSiteTheme
export interface WebSiteThemeProps {
  _id?: Types.ObjectId;
  websiteId: Types.ObjectId;
  themeName: string;
  colors: {
    light: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      surface: string;
      text: string;
      hover:string,
      textSecondary: string;
      border: string;
      success: string;
      warning: string;
      error: string;
      info: string;
    };
    dark: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      surface: string;
      text: string;
      textSecondary: string;
      border: string;
      hover:string,
      success: string;
      warning: string;
      error: string;
      info: string;
    };
  };
  fonts: {
    heading: {
      family: string;
      weight?: string;
      size?: string;
    };
    body: {
      family: string;
      weight?: string;
      size?: string;
    };
    accent?: {
      family: string;
      weight?: string;
      size?: string;
    };
  };
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const WebSiteThemeSchema = new Schema<WebSiteThemeProps>(
  {
    websiteId: {
      type: Schema.Types.ObjectId,
      ref: 'WebSite',
      required: true,
      index: true,
    },
    themeName: {
      type: String,
      required: true,
      trim: true,
      default: 'Default Theme',
    },
    colors: {
      light: {
        primary: { type: String, required: true, trim: true },
        secondary: { type: String, trim: true, default: '#6c757d' },
        accent: { type: String, trim: true, default: '#17a2b8' },
        background: { type: String, required: true, trim: true, default: '#ffffff' },
        surface: { type: String, trim: true, default: '#f8f9fa' },
        text: { type: String, required: true, trim: true, default: '#212529' },
        textSecondary: { type: String, trim: true, default: '#6c757d' },
        border: { type: String, trim: true, default: '#dee2e6' },
        success: { type: String, trim: true, default: '#28a745' },
        warning: { type: String, trim: true, default: '#ffc107' },
        hover: { type: String, trim: true, default: '#000000' },
        error: { type: String, trim: true, default: '#dc3545' },
        info: { type: String, trim: true, default: '#17a2b8' },
      },
      dark: {
        primary: { type: String, required: true, trim: true },
        secondary: { type: String, trim: true, default: '#adb5bd' },
        accent: { type: String, trim: true, default: '#22b8cf' },
        background: { type: String, required: true, trim: true, default: '#212529' },
        surface: { type: String, trim: true, default: '#343a40' },
        text: { type: String, required: true, trim: true, default: '#f8f9fa' },
        textSecondary: { type: String, trim: true, default: '#adb5bd' },
        border: { type: String, trim: true, default: '#495057' },
        success: { type: String, trim: true, default: '#2fb344' },
        warning: { type: String, trim: true, default: '#ffca2c' },
        error: { type: String, trim: true, default: '#e35d6a' },
        hover: { type: String, trim: true, default: '#000000' },
        info: { type: String, trim: true, default: '#22b8cf' },
      },
    },
    fonts: {
      heading: {
        family: { type: String, required: true, trim: true, default: 'Arial, sans-serif' },
        weight: { type: String, trim: true, default: '600' },
        size: { type: String, trim: true, default: '24px' },
      },
      body: {
        family: { type: String, required: true, trim: true, default: 'Arial, sans-serif' },
        weight: { type: String, trim: true, default: '400' },
        size: { type: String, trim: true, default: '16px' },
      },
      accent: {
        family: { type: String, trim: true },
        weight: { type: String, trim: true },
        size: { type: String, trim: true },
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
WebSiteThemeSchema.index({ websiteId: 1, isActive: 1 });
WebSiteThemeSchema.index({ websiteId: 1, themeName: 1 }, { unique: true });

// Virtual field to populate website data
WebSiteThemeSchema.virtual('website', {
  ref: 'WebSite',
  localField: 'websiteId',
  foreignField: '_id',
  justOne: true,
});

const WebSiteThemeModel = mongoose.model<WebSiteThemeProps>('WebSiteTheme', WebSiteThemeSchema);

export default WebSiteThemeModel;