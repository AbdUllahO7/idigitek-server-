// Update ContentElementModel.ts
import mongoose, { Schema } from 'mongoose';
import { IContentElement } from '../types/ContentElement.type';

const contentElementSchema = new Schema<IContentElement>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['text', 'heading', 'array',  'paragraph', 'list', 'image', 'video', 'link', 'custom', 'badge', 'textarea'],
      required: true,
      index: true,
    },
    defaultContent: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    order: {
      type: Number,
      default: 0,
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'SubSection',
      required: true,
      index: true,
    }
  },
  {
    timestamps: true,
  }
);

const ContentElementModel = mongoose.model<IContentElement>('ContentElement', contentElementSchema);

export default ContentElementModel;