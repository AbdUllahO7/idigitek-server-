import mongoose, { Schema } from 'mongoose';
import { IContentTranslation } from '../types/ContentTranslation.type';

const contentTranslationSchema = new Schema<IContentTranslation>(
  {
    content: { type: String, required: true, trim: true },
    language: { type: Schema.Types.ObjectId, ref: 'Languages', required: true, index: true },
    contentElement: { type: Schema.Types.ObjectId, ref: 'ContentElement', required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    metadata: { type: Schema.Types.Mixed }
  },
  {
    timestamps: true,
    toJSON: { virtuals: false },
    toObject: { virtuals: false }
  }
);

// Optimized compound indexes for translations
contentTranslationSchema.index({ contentElement: 1, language: 1 }, { unique: true });
contentTranslationSchema.index({ language: 1, isActive: 1 });
contentTranslationSchema.index({ contentElement: 1, isActive: 1 });
contentTranslationSchema.index({ isActive: 1 });

// Create compound index for efficient querying
contentTranslationSchema.index({ language: 1, contentElement: 1 }, { unique: true });

const ContentTranslationModel = mongoose.model<IContentTranslation>('ContentTranslation', contentTranslationSchema);

export default ContentTranslationModel;