import mongoose, { Schema } from 'mongoose';
import { IContentTranslation } from '../types/ContentTranslation.type';

const contentTranslationSchema = new Schema<IContentTranslation>(
  {
    content: {
      type: String,
      required: true,
      trim: true,
    },
    language: {
      type: Schema.Types.ObjectId,
      ref: 'Languages',
      required: true,
    },
    contentElement: {
      type: Schema.Types.ObjectId,
      ref: 'ContentElement',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    }
  },
  {
    timestamps: true,
  }
);

// Create compound index for efficient querying
contentTranslationSchema.index({ language: 1, contentElement: 1 }, { unique: true });

const ContentTranslationModel = mongoose.model<IContentTranslation>('ContentTranslation', contentTranslationSchema);

export default ContentTranslationModel;