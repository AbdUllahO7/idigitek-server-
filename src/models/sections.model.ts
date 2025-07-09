import mongoose, { Schema } from "mongoose";

interface IMultilingualName {
  en: string;
  ar: string;
  tr: string;
}

interface IMultilingualDescription {
  en?: string;
  ar?: string;
  tr?: string;
}

interface ISection {
  name: IMultilingualName;
  subName: string;
  description: IMultilingualDescription;
  image: string;
  isActive: boolean;
  order: number;
  WebSiteId: Schema.Types.ObjectId;
  sectionItems: Schema.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const sectionSchema = new Schema<ISection>(
  {
    name: {
      en: { type: String, required: true, trim: true, index: true },
      ar: { type: String, required: true, trim: true, index: true },
      tr: { type: String, required: true, trim: true, index: true }
    },
    subName: { type: String, required: true, trim: true, index: true },
    description: {
      en: { type: String, trim: true, default: '' },
      ar: { type: String, trim: true, default: '' },
      tr: { type: String, trim: true, default: '' }
    },
    image: { type: String, default: null },
    isActive: { type: Boolean, default: false, index: true },
    order: { type: Number, default: 0, index: true },
    sectionItems: [{ type: Schema.Types.ObjectId, ref: 'SectionItems' }],
    WebSiteId: { type: Schema.Types.ObjectId, ref: 'WebSite', required: true, index: true }
  },
  {
    timestamps: true,
    // Enable lean queries by default for better performance
    toJSON: { virtuals: false },
    toObject: { virtuals: false }
  }
);

// Optimized compound indexes for common query patterns
sectionSchema.index({ WebSiteId: 1, isActive: 1, order: 1 }); // Most common query
sectionSchema.index({ WebSiteId: 1, 'name.en': 1 }, { unique: true });
sectionSchema.index({ WebSiteId: 1, 'name.ar': 1 }, { unique: true });
sectionSchema.index({ WebSiteId: 1, 'name.tr': 1 }, { unique: true });
sectionSchema.index({ WebSiteId: 1, subName: 1 }, { unique: true });
sectionSchema.index({ isActive: 1, order: 1 }); // For global active sections
sectionSchema.index({ createdAt: -1 }); // For sorting by creation date

// Sparse indexes for optional fields
sectionSchema.index({ image: 1 }, { sparse: true });

export default mongoose.model<ISection>('Sections', sectionSchema);