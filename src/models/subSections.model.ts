import mongoose, { Schema } from 'mongoose';
import { ICreateSubSection } from '../types/sub.section.types';

const subSectionSchema = new Schema<ICreateSubSection>(
  {
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    isActive: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0, index: true },
    isMain: { type: Boolean, default: false, index: true },
    sectionItem: { type: Schema.Types.ObjectId, ref: 'SectionItems', index: true },
    section: { type: Schema.Types.ObjectId, ref: 'Sections', index: true },
    WebSiteId: { type: Schema.Types.ObjectId, ref: 'WebSite', required: true, index: true },
    languages: [{ type: Schema.Types.ObjectId, ref: 'Languages' }],
    metadata: { type: Schema.Types.Mixed }
  },
  {
    timestamps: true,
    toJSON: { virtuals: false },
    toObject: { virtuals: false }
  }
);

// Optimized compound indexes
subSectionSchema.index({ WebSiteId: 1, isActive: 1, order: 1 });
subSectionSchema.index({ sectionItem: 1, isActive: 1, order: 1 });
subSectionSchema.index({ section: 1, isActive: 1, order: 1 });
subSectionSchema.index({ WebSiteId: 1, isMain: 1 });
subSectionSchema.index({ sectionItem: 1, isMain: 1 });
subSectionSchema.index({ section: 1, isMain: 1 });
subSectionSchema.index({ isActive: 1, isMain: 1 });
  // Add a pre-save middleware to ensure consistency when isMain is true
  subSectionSchema.pre('save', async function(next) {
    if (this.isMain && !this.section) {
      // If subsection is marked as main but section isn't set, try to get it from sectionItem
      try {
        const SectionItemModel = mongoose.model('SectionItems');
        const sectionItem = await SectionItemModel.findById(this.sectionItem);
        if (sectionItem) {
          this.section = sectionItem.section;
        }
      } catch (error) {
        // Just continue if we can't set the section
        console.error('Error setting section from sectionItem:', error);
      }
    }
    next();
  });

const SubSectionModel = mongoose.model<ICreateSubSection>('SubSections', subSectionSchema);

export default SubSectionModel;