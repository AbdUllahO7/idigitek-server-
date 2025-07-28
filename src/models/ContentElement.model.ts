import mongoose, { Schema, model } from 'mongoose';
import { IContentElement } from '../types/ContentElement.type';

// Define schema with performance optimizations
const contentElementSchema = new Schema<IContentElement>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true, // Keep index for frequent queries
    },
    type: {
      type: String,
      enum: [
        'text',
        'heading',
        'array',
        'paragraph',
        'file',
        'list',
        'image',
        'video',
        'link',
        'custom',
        'badge',
        'textarea',
        'boolean',
      ],
      required: true,
      index: true, // Keep index for filtering by type
    },
    defaultContent: {
      type: String,
      trim: true,
      sparse: true, // Sparse index for optional fields
    },
    imageUrl: {
      type: String,
      trim: true,
      sparse: true,
    },
    fileUrl: {
      type: String,
      trim: true,
      sparse: true,
    },
    fileName: {
      type: String,
      trim: true,
      sparse: true,
    },
    fileSize: {
      type: Number,
      sparse: true,
    },
    fileMimeType: {
      type: String,
      trim: true,
      sparse: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true, // Add index for frequent filtering
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}, // Default to empty object for consistency
    },
    order: {
      type: Number,
      default: 0,
      index: true, // Index for sorting operations
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'SubSection',
      required: true,
      index: true, // Keep index for lookups
    },
  },
  {
    timestamps: true,
    // Optimize query performance
    autoIndex: false, // Disable auto-indexing in production
    toJSON: { virtuals: true, getters: true }, // Enable virtuals for API responses
    toObject: { virtuals: true },
    // Minimize storage overhead
    minimize: false, // Keep empty objects in Mixed type
  }
);

// Compound index for common query patterns
contentElementSchema.index({ parent: 1, order: 1, isActive: 1 });

// Pre-validate hook to clean up unused fields based on type
contentElementSchema.pre('validate', function (next) {
  const doc = this as IContentElement;

  // Clean up fields based on type to reduce storage
  if (doc.type !== 'image') {
    doc.imageUrl = undefined;
  }
  if (doc.type !== 'file') {
    doc.fileUrl = undefined;
    doc.fileName = undefined;
    doc.fileSize = undefined;
    doc.fileMimeType = undefined;
  }
  if (!['text', 'heading', 'paragraph', 'textarea'].includes(doc.type)) {
    doc.defaultContent = undefined;
  }

  next();
});

// Virtual for computed fields (if needed)
contentElementSchema.virtual('isMedia').get(function () {
  return ['image', 'video', 'file'].includes(this.type);
});

// Lean queries for read-heavy operations
contentElementSchema.statics.findLean = function (query: any) {
  return this.find(query).lean().exec();
};

// Create model
const ContentElementModel = model<IContentElement>('ContentElement', contentElementSchema);

export default ContentElementModel;