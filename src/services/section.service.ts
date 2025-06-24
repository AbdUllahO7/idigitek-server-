import mongoose, { Schema } from 'mongoose';
import ContentElementModel from '../models/ContentElement.model';
import ContentTranslationModel from '../models/ContentTranslation.model';
import SectionModel from '../models/sections.model';
import SubSectionModel from '../models/subSections.model';
import SectionItemModel from '../models/sectionItems.model';
import { boolean } from 'joi';

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


export class SectionService {
  // Create a new section
async createSection(sectionData: {
    name: IMultilingualName;
    subName: string; 
    description?: IMultilingualDescription;
    image?: string;
    isActive?: boolean;
    order?: number;
    WebSiteId: Schema.Types.ObjectId,
  }) {
    console.log('Creating section with multilingual data:', sectionData);
    
    try {
      // Validate multilingual names
      this.validateMultilingualName(sectionData.name);
      
      // Check for duplicate names in all languages
      await this.checkDuplicateNames(sectionData.name, sectionData.WebSiteId);
      
      // Check for duplicate subName (for backend matching)
      const existingSubName = await SectionModel.findOne({
        subName: sectionData.subName,
        WebSiteId: sectionData.WebSiteId
      });
      
      if (existingSubName) {
        throw new Error(`A section with subName "${sectionData.subName}" already exists for this website`);
      }
      
      // Ensure description has all languages
      const description: IMultilingualDescription = {
        en: sectionData.description?.en || '',
        ar: sectionData.description?.ar || '',
        tr: sectionData.description?.tr || ''
      };
      
      const section = new SectionModel({
        ...sectionData,
        description
      });
      
      await section.save();
      return section;
    } catch (error: any) {
      console.error('Error creating section:', error);
      throw error;
    }
  }

  private validateMultilingualName(name: IMultilingualName): void {
    const languages = ['en', 'ar', 'tr'] as const;
    
    for (const lang of languages) {
      if (!name[lang] || name[lang].trim() === '') {
        throw new Error(`Section name in ${lang.toUpperCase()} is required`);
      }
      
      if (name[lang].trim().length < 2) {
        throw new Error(`Section name in ${lang.toUpperCase()} must be at least 2 characters`);
      }
      
      if (name[lang].trim().length > 100) {
        throw new Error(`Section name in ${lang.toUpperCase()} must be less than 100 characters`);
      }
    }
  }

  private async checkDuplicateNames(
    name: IMultilingualName, 
    websiteId: Schema.Types.ObjectId, 
    excludeId?: string
  ): Promise<void> {
    const languages = ['en', 'ar', 'tr'] as const;
    
    for (const lang of languages) {
      const query: any = {
        [`name.${lang}`]: name[lang].trim(),
        WebSiteId: websiteId
      };
      
      if (excludeId) {
        query._id = { $ne: excludeId };
      }
      
      const existingSection = await SectionModel.findOne(query);
      
      if (existingSection) {
        throw new Error(`A section with the ${lang.toUpperCase()} name "${name[lang].trim()}" already exists for this website`);
      }
    }
  }

  // Update section
  async updateSection(id: string, updateData: any) {
      try {
        // Get the current section
        const currentSection = await SectionModel.findById(id);
        if (!currentSection) {
          throw new Error('Section not found');
        }
        
        // If multilingual name is being updated
        if (updateData.name) {
          this.validateMultilingualName(updateData.name);
          await this.checkDuplicateNames(updateData.name, currentSection.WebSiteId, id);
        }
        
        // If subName is being updated
        if (updateData.subName && updateData.subName !== currentSection.subName) {
          const existingSubName = await SectionModel.findOne({
            subName: updateData.subName,
            WebSiteId: currentSection.WebSiteId,
            _id: { $ne: id }
          });
          
          if (existingSubName) {
            throw new Error(`A section with subName "${updateData.subName}" already exists for this website`);
          }
        }
        
        // Handle image update (keep existing logic)
        let oldImageUrl;
        if (updateData.image !== undefined) {
          if (currentSection.image) {
            oldImageUrl = currentSection.image;
          }
        }
        
        const section = await SectionModel.findByIdAndUpdate(
          id,
          updateData,
          { new: true, runValidators: true }
        );
        
        if (!section) {
          throw new Error('Section not found');
        }
        
        // Handle old image deletion (keep existing logic)
        if (oldImageUrl && updateData.image && updateData.image !== oldImageUrl) {
          try {
            const cloudinaryService = (await import('../services/cloudinary.service')).default;
            const publicId = cloudinaryService.getPublicIdFromUrl(oldImageUrl);
            if (publicId) {
              cloudinaryService.deleteImage(publicId).catch(err => {
                console.error('Failed to delete old image:', err);
              });
            }
          } catch (error) {
            console.error('Error importing cloudinary service:', error);
          }
        }
        
        return section;
      } catch (error: any) {
        if (error.name === 'MongoServerError' && error.code === 11000) {
          throw new Error('A section with the same name already exists for this website');
        }
        throw error;
      }
    }

    getSectionNameByLanguage(section: any, language: 'en' | 'ar' | 'tr' = 'en'): string {
    if (typeof section.name === 'object' && section.name[language]) {
      return section.name[language];
    }
    
    // Fallback for legacy sections with string names
    if (typeof section.name === 'string') {
      return section.name;
    }
    
    return section.subName || 'Unknown Section';
  }

getSectionDescriptionByLanguage(section: any, language: 'en' | 'ar' | 'tr' = 'en'): string {
    if (typeof section.description === 'object' && section.description[language]) {
      return section.description[language];
    }
    
    // Fallback for legacy sections with string descriptions
    if (typeof section.description === 'string') {
      return section.description;
    }
    
    return '';
  }
  // Get all sections
   async getAllSections(query: any = {}) {
    try {
      const sections = await SectionModel.find(query).sort({ order: 1 });
      return sections;
    } catch (error) {
      throw error;
    }
  }

  // Get section by ID
  async getSectionById(id: string) {
      try {
        const section = await SectionModel.findById(id);
        if (!section) {
          throw new Error('Section not found');
        }
        return section;
      } catch (error) {
        throw error;
      }
    }

  // Update section status
  async updateSectionStatus(id: string, isActive: boolean) {
      try {
        const section = await SectionModel.findByIdAndUpdate(
          id,
          { isActive },
          { new: true, runValidators: true }
        );
        
        if (!section) {
          throw new Error('Section not found');
        }
        
        return section;
      } catch (error) {
        throw error;
      }
    }
  // Delete section with complete cascade deletion
  async deleteSection(id: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      console.log(`🗑️ Starting cascade deletion for section: ${id}`);
      
      // Get the section with its image
      const section = await SectionModel.findById(id).session(session);
      if (!section) {
        throw new Error('Section not found');
      }
      
      // Store the image URL for later deletion if it exists
      const imageUrl = section.image;
      console.log(`📁 Section found: ${section.name}, Image: ${imageUrl || 'none'}`);
      
      // STEP 1: Find all SectionItems belonging to this section
      const sectionItems = await SectionItemModel.find({ section: id }).session(session);
      const sectionItemIds = sectionItems.map(item => item._id);
      console.log(`📦 Found ${sectionItems.length} section items:`, sectionItemIds);
      
      // STEP 2: Find all SubSections belonging to this section (both direct and through section items)
      const subsections = await SubSectionModel.find({
        $or: [
          { section: id }, // Direct relationship
          { sectionItem: { $in: sectionItemIds } } // Through section items
        ]
      }).session(session);
      const subsectionIds = subsections.map(subsection => subsection._id);
      console.log(`📑 Found ${subsections.length} subsections:`, subsectionIds);
      
      // STEP 3: Find all ContentElements for section, section items, and subsections
      const contentElements = await ContentElementModel.find({
        $or: [
          // Elements directly belonging to the section
          { parent: id },
          // Elements belonging to section items
          { parent: { $in: sectionItemIds } },
          // Elements belonging to subsections
          { parent: { $in: subsectionIds } },
          // Legacy format - if you're using parentType/parentId
          { parentType: 'section', parentId: id },
          { parentType: 'sectionItem', parentId: { $in: sectionItemIds } },
          { parentType: 'subsection', parentId: { $in: subsectionIds } }
        ]
      }).session(session);
      const contentElementIds = contentElements.map(element => element._id);
      console.log(`🧩 Found ${contentElements.length} content elements:`, contentElementIds);
      
      // STEP 4: Delete all ContentTranslations for these elements
      const deletedTranslations = await ContentTranslationModel.deleteMany({
        $or: [
          { contentElement: { $in: contentElementIds } },
          { elementId: { $in: contentElementIds } } // Handle both field names
        ]
      }).session(session);
      console.log(`🌐 Deleted ${deletedTranslations.deletedCount} content translations`);
      
      // STEP 5: Delete all ContentElements
      const deletedElements = await ContentElementModel.deleteMany({
        $or: [
          // Elements directly belonging to the section
          { parent: id },
          // Elements belonging to section items
          { parent: { $in: sectionItemIds } },
          // Elements belonging to subsections
          { parent: { $in: subsectionIds } },
          // Legacy format
          { parentType: 'section', parentId: id },
          { parentType: 'sectionItem', parentId: { $in: sectionItemIds } },
          { parentType: 'subsection', parentId: { $in: subsectionIds } }
        ]
      }).session(session);
      console.log(`🧩 Deleted ${deletedElements.deletedCount} content elements`);
      
      // STEP 6: Delete all SubSections
      const deletedSubsections = await SubSectionModel.deleteMany({
        $or: [
          { section: id },
          { sectionItem: { $in: sectionItemIds } }
        ]
      }).session(session);
      console.log(`📑 Deleted ${deletedSubsections.deletedCount} subsections`);
      
      // STEP 7: Delete all SectionItems
      const deletedSectionItems = await SectionItemModel.deleteMany({ 
        section: id 
      }).session(session);
      console.log(`📦 Deleted ${deletedSectionItems.deletedCount} section items`);
      
      // STEP 8: Finally, delete the section itself
      const deletedSection = await SectionModel.findByIdAndDelete(id).session(session);
      console.log(`🗑️ Deleted section: ${deletedSection?.name}`);
      
      // Commit the transaction
      await session.commitTransaction();
      console.log(`✅ Successfully deleted section ${id} and all related data`);
      
      // STEP 9: Delete the image from Cloudinary if it exists (after transaction is committed)
      if (imageUrl) {
        try {
          const cloudinaryService = require('../services/cloudinary.service').default;
          const publicId = cloudinaryService.getPublicIdFromUrl(imageUrl);
          if (publicId) {
            console.log(`🖼️ Deleting image from Cloudinary: ${publicId}`);
            // Delete in the background, don't wait for it
            cloudinaryService.deleteImage(publicId).catch((err: any) => {
              console.error('Failed to delete section image:', err);
            });
          }
        } catch (error) {
          console.error('Error importing cloudinary service:', error);
        }
      }
      
      return { 
        message: 'Section and all related data deleted successfully',
        deletedCounts: {
          sections: 1,
          sectionItems: deletedSectionItems.deletedCount,
          subsections: deletedSubsections.deletedCount,
          contentElements: deletedElements.deletedCount,
          contentTranslations: deletedTranslations.deletedCount
        }
      };
      
    } catch (error) {
      await session.abortTransaction();
      console.error(`❌ Error deleting section ${id}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Helper method to verify deletion was complete
  async verifyDeletionComplete(sectionId: string) {
    try {
      console.log(`🔍 Verifying deletion for section: ${sectionId}`);
      
      // Check if section still exists
      const section = await SectionModel.findById(sectionId);
      console.log(`Section exists: ${!!section}`);
      
      // Check for orphaned section items
      const orphanedSectionItems = await SectionItemModel.find({ section: sectionId });
      console.log(`Orphaned section items: ${orphanedSectionItems.length}`);
      
      // Check for orphaned subsections
      const orphanedSubsections = await SubSectionModel.find({ 
        $or: [
          { section: sectionId },
          { sectionItem: { $in: orphanedSectionItems.map(item => item._id) } }
        ]
      });
      console.log(`Orphaned subsections: ${orphanedSubsections.length}`);
      
      // Check for orphaned content elements
      const orphanedElements = await ContentElementModel.find({
        $or: [
          { parent: sectionId },
          { parentType: 'section', parentId: sectionId }
        ]
      });
      console.log(`Orphaned content elements: ${orphanedElements.length}`);
      
      const isComplete = !section && 
                        orphanedSectionItems.length === 0 && 
                        orphanedSubsections.length === 0 && 
                        orphanedElements.length === 0;
      
      return {
        isComplete,
        orphanedData: {
          section: !!section,
          sectionItems: orphanedSectionItems.length,
          subsections: orphanedSubsections.length,
          contentElements: orphanedElements.length
        }
      };
    } catch (error) {
      console.error('Error verifying deletion:', error);
      throw error;
    }
  }

  // Get section with all related content (subsections and content elements)
  async getSectionWithContent(id: string, languageId: string) {
    try {
      const section = await SectionModel.findById(id);
      if (!section) {
        throw new Error('Section not found');
      }
      
      // Get all subsections for this section
      const subsections = await SubSectionModel.find({ sectionId: id }).sort({ order: 1 });
      
      // Get all content elements for the section
      const sectionElements = await ContentElementModel.find({
        parentType: 'section',
        parentId: id
      }).sort({ order: 1 });
      
      // Get all content element IDs for section and subsections
      const sectionElementIds = sectionElements.map(el => el._id);
      const subsectionIds = subsections.map(sub => sub._id);
      
      // Get all content elements for the subsections
      const subsectionElements = await ContentElementModel.find({
        parentType: 'subsection',
        parentId: { $in: subsectionIds }
      }).sort({ order: 1 });
      
      const allElementIds = [...sectionElementIds, ...subsectionElements.map(el => el._id)];
      
      // Get all translations for the content elements
      const translations = await ContentTranslationModel.find({
        elementId: { $in: allElementIds },
        languageId
      });
      
      // Map translations to their elements
      const translationsMap = translations.reduce((map, trans) => {
        map[trans.id.toString()] = trans.content;
        return map;
      }, {} as Record<string, any>);
      
      // Add translations to section elements
      const sectionElementsWithTranslations = sectionElements.map(element => ({
        ...element.toObject(),
        value: translationsMap[element._id.toString()] || null
      }));
      
      // Process subsections with their elements and translations
      const subsectionsWithContent = await Promise.all(subsections.map(async (subsection) => {
        const subsectionElementsForThisSubsection = subsectionElements.filter(
          el => el.parent.toString() === subsection._id.toString()
        );
        
        const elementsWithTranslations = subsectionElementsForThisSubsection.map(element => ({
          ...element.toObject(),
          value: translationsMap[element._id.toString()] || null
        }));
        
        return {
          ...subsection.toObject(),
          elements: elementsWithTranslations
        };
      }));
      
      return {
        ...section.toObject(),
        elements: sectionElementsWithTranslations,
        subsections: subsectionsWithContent
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get section by ID with all related data (section items and subsections)
   * @param id Section ID
   * @param includeInactive Whether to include inactive items
   * @param languageId Optional language ID for translations
   */
  async getSectionWithCompleteData(id: string, includeInactive: boolean = false, languageId?: string) {
    try {
      // 1. Fetch the section
      const section = await SectionModel.findById(id);
      if (!section) {
        throw new Error('Section not found');
      }
      
      // 2. Fetch section items that belong to this section
      const query: any = { section: id };
      if (!includeInactive) {
        query.isActive = true;
      }
      
      const sectionItems = await SectionItemModel.find(query).sort({ order: 1 });
      const sectionItemIds = sectionItems.map(item => item._id);
      
      // 3. Fetch subsections for all section items
      const subsectionQuery: any = { sectionItem: { $in: sectionItemIds } };
      if (!includeInactive) {
        subsectionQuery.isActive = true;
      }
      
      const subsections = await SubSectionModel.find(subsectionQuery).sort({ order: 1 });
      
      // Group subsections by sectionItem
      const subsectionsByItem = subsections.reduce((acc: Record<string, any[]>, subsection) => {
        const itemId = subsection.sectionItem.toString();
        if (!acc[itemId]) {
          acc[itemId] = [];
        }
        acc[itemId].push(subsection);
        return acc;
      }, {});
      
      // 4. If language is provided, fetch content translations
      let translationsMap: Record<string, any> = {};
      
      if (languageId) {
        // Get all subsection IDs
        const subsectionIds = subsections.map(sub => sub._id);
        
        // Find all content elements for section, section items and subsections
        const contentElements = await ContentElementModel.find({
          $or: [
            { parentType: 'section', parentId: id },
            { parentType: 'sectionItem', parentId: { $in: sectionItemIds } },
            { parentType: 'subsection', parentId: { $in: subsectionIds } }
          ]
        }).sort({ order: 1 });
        
        const elementIds = contentElements.map(el => el._id);
        
        // Get all translations for these elements
        const translations = await ContentTranslationModel.find({
          elementId: { $in: elementIds },
          languageId
        });
        
        // Map translations to their elements
        translationsMap = translations.reduce((map, trans) => {
          map[trans.id.toString()] = trans.content;
          return map;
        }, {} as Record<string, any>);
        
        // Group content elements by parent
        const elementsByParent = contentElements.reduce((acc: Record<string, any[]>, element) => {
          const parentKey = `${element.type}-${element.parent.toString()}`;
          if (!acc[parentKey]) {
            acc[parentKey] = [];
          }
          
          // Add translation to element
          const elementWithTranslation = {
            ...element.toObject(),
            value: translationsMap[element._id.toString()] || null
          };
          
          acc[parentKey].push(elementWithTranslation);
          return acc;
        }, {});
        
        // Add content elements to section
        const sectionKey = `section-${id}`;
        section.sectionItems = elementsByParent[sectionKey] || [];
        
        // Add content elements to each section item
        sectionItems.forEach(item => {
          const itemKey = `sectionItem-${item._id.toString()}`;
          item.elements = elementsByParent[itemKey] || [];
        });
        
        // Add content elements to each subsection
        subsections.forEach(subsection => {
          const subKey = `subsection-${subsection._id.toString()}`;
          subsection.elements = elementsByParent[subKey] || [];
        });
      }
      
      // 5. Build the complete structure with all data
      const sectionItemsWithSubsections = sectionItems.map(item => {
        const itemId = item._id.toString();
        return {
          ...item.toObject(),
          subsections: subsectionsByItem[itemId] || []
        };
      });
      
      const result = {
        ...section.toObject(),
        sectionItems: sectionItemsWithSubsections
      };
      
      return result;
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all sections with their related items and subsections
   * @param query Filter query
   * @param includeInactive Whether to include inactive items
   * @param languageId Optional language ID for translations
   */
  async getAllSectionsWithData(query: any = {}, includeInactive: boolean = false, languageId?: string) {
    try {
      // 1. Fetch all sections
      const sections = await SectionModel.find(query).sort({ order: 1 });
      
      // 2. Fetch all section items
      const sectionIds = sections.map(section => section._id);
      
      const itemQuery: any = { section: { $in: sectionIds } };
      if (!includeInactive) {
        itemQuery.isActive = true;
      }
      
      const allSectionItems = await SectionItemModel.find(itemQuery).sort({ order: 1 });
      
      // Group section items by section
      const itemsBySection = allSectionItems.reduce((acc: Record<string, any[]>, item) => {
        const sectionId = item.section.toString();
        if (!acc[sectionId]) {
          acc[sectionId] = [];
        }
        acc[sectionId].push(item);
        return acc;
      }, {});
      
      // 3. Fetch all subsections
      const sectionItemIds = allSectionItems.map(item => item._id);
      
      const subsectionQuery: any = { sectionItem: { $in: sectionItemIds } };
      if (!includeInactive) {
        subsectionQuery.isActive = true;
      }
      
      const allSubsections = await SubSectionModel.find(subsectionQuery).sort({ order: 1 });
      
      // Group subsections by section item
      const subsectionsByItem = allSubsections.reduce((acc: Record<string, any[]>, subsection) => {
        const itemId = subsection.sectionItem.toString();
        if (!acc[itemId]) {
          acc[itemId] = [];
        }
        acc[itemId].push(subsection);
        return acc;
      }, {});
      
      // 4. If language is provided, fetch content translations (similar to above)
      let translationsMap: Record<string, any> = {};
      let elementsByParent: Record<string, any[]> = {};
      
      if (languageId) {
        // This part would be similar to the getSectionWithCompleteData method
        // You would fetch all content elements and translations for sections, items, and subsections
        // And organize them by parent ID
      }
      
      // 5. Build complete structure with all data
      const sectionsWithItems = sections.map(section => {
        const sectionId = section._id.toString();
        const items = itemsBySection[sectionId] || [];
        
        // Add subsections to each item
        const itemsWithSubsections = items.map(item => {
          const itemId = item._id.toString();
          return {
            ...item.toObject(),
            subsections: subsectionsByItem[itemId] || [],
            // Add elements if language was provided
            ...(languageId ? { elements: elementsByParent[`sectionItem-${itemId}`] || [] } : {})
          };
        });
        
        return {
          ...section.toObject(),
          sectionItems: itemsWithSubsections,
          // Add elements if language was provided
          ...(languageId ? { elements: elementsByParent[`section-${sectionId}`] || [] } : {})
        };
      });
      
      return sectionsWithItems;
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all sections for a specific website
   * @param websiteId The ID of the website
   * @param includeInactive Whether to include inactive sections (default: false)
   * @returns Array of sections belonging to the website
   */
  async getSectionsByWebsiteId(websiteId: Schema.Types.ObjectId | string, includeInactive: boolean = false) {
    try {
      if (!websiteId) {
        throw new Error('Website ID is required');
      }

      const query: any = { WebSiteId: websiteId };
      if (!includeInactive) {
        query.isActive = true;
      }
      
      const sections = await SectionModel.find(query).sort({ order: 1 });
      return sections;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all sections with complete data for a specific website
   * @param websiteId The ID of the website
   * @param includeInactive Whether to include inactive items (default: false)
   * @param languageId Optional language ID for translations
   * @returns Array of sections with their items and subsections
   */
  async getSectionsWithDataByWebsiteId(
    websiteId: Schema.Types.ObjectId | string, 
    includeInactive: boolean = false, 
    languageId?: string
  ) {
    try {
      if (!websiteId) {
        throw new Error('Website ID is required');
      }

      // Get sections for this website
      const query: { WebSiteId: Schema.Types.ObjectId | string; isActive?: boolean } = { WebSiteId: websiteId };
      if (!includeInactive) {
        query.isActive = true;
      }
      
      // Use the existing getAllSectionsWithData method with our website-specific query
      const sectionsWithData = await this.getAllSectionsWithData(
        query,
        includeInactive,
        languageId
      );
      
      return sectionsWithData;
    } catch (error) {
      throw error;
    }
  }
  /**
 * Check if a section with the given name already exists for a website
 * Useful for debugging duplicate section name issues
 */
   async checkExistingSections(name: IMultilingualName | string, websiteId: Schema.Types.ObjectId | string) {
    try {
      let query: any = {};
      
      // Handle both legacy string names and new multilingual names
      if (typeof name === 'string') {
        query = {
          $or: [
            { 'name.en': name },
            { 'name.ar': name },
            { 'name.tr': name },
            { name: name } // For legacy string names
          ]
        };
      } else {
        query = {
          $or: [
            { 'name.en': name.en },
            { 'name.ar': name.ar },
            { 'name.tr': name.tr }
          ]
        };
      }
      
      const allSectionsWithName = await SectionModel.find(query);
      
      // Find sections for this specific website
      const websiteQuery = { ...query, WebSiteId: websiteId };
      const sectionsForWebsite = await SectionModel.find(websiteQuery);
      
      const indexes = await SectionModel.collection.indexes();
      
      return { 
        allSectionsWithName, 
        sectionsForWebsite,
        indexes 
      };
    } catch (error) {
      console.error('Error checking existing sections:', error);
      throw error;
    }
  }
    /**
   * Update the order of a section within a website
   * @param sectionId The ID of the section to reorder
   * @param newOrder The new order value for the section
   * @param websiteId The ID of the website
   * @returns The updated section
   */
 async updateSectionOrder(sections: { sectionId: string; newOrder: number; websiteId: Schema.Types.ObjectId | string }[], maxRetries = 3) {
    let attempt = 0;

    while (attempt < maxRetries) {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();

        if (!sections.length) {
          throw new Error('At least one section is required');
        }

        const websiteId = sections[0].websiteId;
        if (!websiteId) {
          throw new Error('Website ID is required');
        }

        const sectionIds = sections.map(s => s.sectionId);
        const existingSections = await SectionModel.find({ 
          _id: { $in: sectionIds }, 
          WebSiteId: websiteId 
        }).session(session);

        if (existingSections.length !== sections.length) {
          throw new Error('One or more sections not found or do not belong to the specified website');
        }

        const allSections = await SectionModel.find({ WebSiteId: websiteId })
          .sort({ order: 1 })
          .session(session);

        const maxOrder = allSections.length - 1;

        for (const { newOrder } of sections) {
          if (!Number.isInteger(newOrder) || newOrder < 0 || newOrder > maxOrder) {
            throw new Error(`Order value must be between 0 and ${maxOrder}`);
          }
        }

        const updates = sections.map(({ sectionId, newOrder }) => ({
          updateOne: {
            filter: { _id: sectionId, WebSiteId: websiteId },
            update: { $set: { order: newOrder } },
          },
        }));

        await SectionModel.bulkWrite(updates, { session });

        const updatedSections = await SectionModel.find({ 
          _id: { $in: sectionIds }, 
          WebSiteId: websiteId 
        }).session(session);

        await session.commitTransaction();
        return updatedSections;
      } catch (error: any) {
        await session.abortTransaction();
        
        if (error.name === 'MongoBulkWriteError' && error.message.includes('Write conflict')) {
          attempt++;
          if (attempt >= maxRetries) {
            throw new Error('Max retries reached for write conflict. Please try again later.');
          }
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
          continue;
        }
        
        throw error;
      } finally {
        session.endSession();
      }
    }

    throw new Error('Unexpected error: Retry loop exited without resolution');
  }
}


