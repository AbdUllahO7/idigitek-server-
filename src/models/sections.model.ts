import mongoose, { Schema } from "mongoose";

// Multilingual name interface
interface IMultilingualName {
  en: string;
  ar: string;
  tr: string;
}

// Multilingual description interface
interface IMultilingualDescription {
  en?: string;
  ar?: string;
  tr?: string;
}

interface ISection {
  name: IMultilingualName; // 🎯 UPDATED: Multilingual name object
  subName: string; // Keep original subName for backend matching
  description: IMultilingualDescription; // 🎯 UPDATED: Multilingual description
  image: string;
  isActive: boolean;
  order: number;
  WebSiteId: Schema.Types.ObjectId;
  sectionItems: Schema.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const multilingualNameSchema = new Schema<IMultilingualName>({
  en: {
    type: String,
    required: true,
    trim: true
  },
  ar: {
    type: String,
    required: true,
    trim: true
  },
  tr: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false });

const multilingualDescriptionSchema = new Schema<IMultilingualDescription>({
  en: {
    type: String,
    trim: true,
    default: ''
  },
  ar: {
    type: String,
    trim: true,
    default: ''
  },
  tr: {
    type: String,
    trim: true,
    default: ''
  }
}, { _id: false });

const sectionSchema = new Schema<ISection>(
  {
    name: {
      type: multilingualNameSchema,
      required: true
    },
    subName: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: multilingualDescriptionSchema,
      default: () => ({ en: '', ar: '', tr: '' })
    },
    image: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    sectionItems: [{
      type: Schema.Types.ObjectId,
      ref: 'SectionItems'
    }],
    WebSiteId: {
      type: Schema.Types.ObjectId,
      ref: 'WebSite',
      required: true
    }
  },
  {
    timestamps: true,
  }
);

// 🎯 UPDATED: Compound indexes for multilingual name uniqueness
// Ensure English names are unique within a website
sectionSchema.index({ 'name.en': 1, WebSiteId: 1 }, { unique: true });
// Ensure Arabic names are unique within a website  
sectionSchema.index({ 'name.ar': 1, WebSiteId: 1 }, { unique: true });
// Ensure Turkish names are unique within a website
sectionSchema.index({ 'name.tr': 1, WebSiteId: 1 }, { unique: true });

// Index for subName and WebSiteId for backend matching
sectionSchema.index({ subName: 1, WebSiteId: 1 }, { unique: true });

const SectionModel = mongoose.model<ISection>('Sections', sectionSchema);
export default SectionModel;