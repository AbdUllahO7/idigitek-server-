import mongoose, { Schema } from "mongoose";

interface ISection {
  name: string;
  subName: string; 
  description: string;
  image: string;
  isActive: boolean;
  order: number;
  WebSiteId: Schema.Types.ObjectId;
  sectionItems: Schema.Types.ObjectId[]; // Added reference to section items
  createdAt: Date;
  updatedAt: Date;
}

const sectionSchema = new Schema<ISection>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
     subName: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
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

// Add compound index for name and WebSiteId - this is the key change!
// This ensures that section names are unique within a website but can be duplicated across websites
sectionSchema.index({ name: 1, WebSiteId: 1 }, { unique: true });

const SectionModel = mongoose.model<ISection>('Sections', sectionSchema);
export default SectionModel;