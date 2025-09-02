import mongoose, { Schema, model } from 'mongoose';
import { IServiceDocument } from '../types/sectionItem.types';

// Define schema with performance optimizations
const sectionItemSchema = new Schema<IServiceDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true, // Index for frequent name-based queries
      maxlength: 255, // Limit name length for consistency
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000, // Limit description length
    },
    image: {
      type: String,
      default: null,
      sparse: true, // Sparse index for optional images
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true, // Index for filtering active items
    },
    order: {
      type: Number,
      default: 0,
      index: true, // Index for sorting
    },
    isMain: {
      type: Boolean,
      default: false,
    },
    WebSiteId: {
      type: Schema.Types.ObjectId,
      ref: 'WebSite',
      required: true,
      index: true, // Index for lookups by website
    },
    section: {
      type: Schema.Types.ObjectId,
      ref: 'Sections',
      required: true,
      index: true, // Index for lookups by section
    },
    subsections: [{
      type: Schema.Types.ObjectId,
      ref: 'SubSections',
      index: true, // Index for efficient population
    }],
  },
  {
    timestamps: true,
    autoIndex: false, // Disable auto-indexing in production
    toJSON: { virtuals: true, getters: true }, // Enable virtuals for API responses
    toObject: { virtuals: true },
    minimize: false, // Preserve empty objects
  }
);

// Compound index for common query patterns
sectionItemSchema.index({ WebSiteId: 1, section: 1, isActive: 1 });

// Static method for lean queries
sectionItemSchema.statics.findLean = function (query: any) {
  return this.find(query).lean().exec();
};


sectionItemSchema.pre('save', async function (next) {
  const doc = this as IServiceDocument;
  if (doc.isModified('order')) {
    try {
      const existing = await SectionItemModel.findOne({
        section: doc.section,
        order: doc.order,
        _id: { $ne: doc._id },
      });
      if (existing) throw new Error('Order must be unique within section');
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});


// Create model
const SectionItemModel = model<IServiceDocument>('SectionItems', sectionItemSchema);

export default SectionItemModel;