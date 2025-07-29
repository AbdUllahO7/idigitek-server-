import mongoose, { Schema, model } from 'mongoose';
import { IContentTranslation } from '../types/ContentTranslation.type';

// Define schema with performance optimizations
const contentTranslationSchema = new Schema<IContentTranslation>(
  {
    content: {
      type: String,
      required: true,
      trim: true,
      index: true, 
    },
    language: {
      type: Schema.Types.ObjectId,
      ref: 'Languages',
      required: true,
      index: true, 
    },
    contentElement: {
      type: Schema.Types.ObjectId,
      ref: 'ContentElement',
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true, 
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}, 
      sparse: true, 
    },
  },
  {
    timestamps: true,
    autoIndex: false, 
    toJSON: { virtuals: true, getters: true }, 
    toObject: { virtuals: true },
    minimize: false, 
  }
);

contentTranslationSchema.index({ language: 1, contentElement: 1 }, { unique: true });

contentTranslationSchema.index({ contentElement: 1, isActive: 1 });

contentTranslationSchema.pre('validate', function (next) {
  const doc = this as IContentTranslation;
  if (!Object.keys(doc.metadata || {}).length) {
    doc.metadata = undefined; 
  }
  next();
});

contentTranslationSchema.statics.findLean = function (query: any) {
  return this.find(query).lean().exec();
};

const ContentTranslationModel = model<IContentTranslation>('ContentTranslation', contentTranslationSchema);

export default ContentTranslationModel;