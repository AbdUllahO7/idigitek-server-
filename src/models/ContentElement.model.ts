import mongoose, { Schema } from 'mongoose';
import { IContentElement } from '../types/ContentElement.type';

const contentElementSchema = new Schema<IContentElement>(
  {
    name: { type: String, required: true, trim: true, index: true },
    type: { 
      type: String, 
      enum: ['text', 'heading', 'array', 'paragraph', 'file', 'list', 'image', 'video', 'link', 'custom', 'badge', 'textarea', 'boolean'],
      required: true, 
      index: true 
    },
    defaultContent: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    fileUrl: { type: String, trim: true },
    fileName: { type: String, trim: true },
    fileSize: { type: Number },
    fileMimeType: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    metadata: { type: Schema.Types.Mixed },
    order: { type: Number, default: 0, index: true },
    parent: { type: Schema.Types.ObjectId, ref: 'SubSection', required: true, index: true }
  },
  {
    timestamps: true,
    toJSON: { virtuals: false },
    toObject: { virtuals: false }
  }
);

// Optimized compound indexes for content elements
contentElementSchema.index({ parent: 1, isActive: 1, order: 1 }); // Most common query
contentElementSchema.index({ parent: 1, type: 1, isActive: 1 });
contentElementSchema.index({ type: 1, isActive: 1 });
contentElementSchema.index({ isActive: 1, order: 1 });
const ContentElementModel = mongoose.model<IContentElement>('ContentElement', contentElementSchema);

export default ContentElementModel;