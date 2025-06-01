import mongoose, { Schema } from 'mongoose';
import ContentElementModel from '../models/ContentElement.model';
import ContentTranslationModel from '../models/ContentTranslation.model';
import SectionModel from '../models/sections.model';
import SubSectionModel from '../models/subSections.model';
import SectionItemModel from '../models/sectionItems.model';
import { boolean } from 'joi';

export class SectionService {
  // Create a new section
  async createSection(sectionData: {
    name: string;
    subName : string; 
    description?: string;
    image?: string;
    isActive?: boolean;
    order?: number;
    WebSiteId: Schema.Types.ObjectId,
  }) {
    console.log('Creating section with data:', sectionData);
    try {
    
      const section = new SectionModel(sectionData);
      await section.save();
      return section;
    } catch (error: any) {
    
      throw error;
    }
  }

  // Update section
  async updateSection(id: string, updateData: any) {
    try {
      // If name is being updated, ensure it's not null, undefined, or empty
      if (updateData.name !== undefined) {
        if (!updateData.name || updateData.name.trim() === '') {
          throw new Error('Section name cannot be empty');
        }
        
        // Get the current section to retrieve its WebSiteId
        const currentSection = await SectionModel.findById(id);
        if (!currentSection) {
          throw new Error('Section not found');
        }
        
        // Check if another section with the same name already exists FOR THE SAME WEBSITE
        // Again, this is the key change - we only check for duplicates within the same website
        const existingSection = await SectionModel.findOne({ 
          name: updateData.name,
          WebSiteId: currentSection.WebSiteId,
          _id: { $ne: id } // Exclude current section from check
        });
        
        if (existingSection) {
          throw new Error(`Another section with name "${updateData.name}" already exists for this website`);
        }
      }
      
      // If we're updating the image, get the current section to check for an existing image
      let oldImageUrl;
      if (updateData.image !== undefined) {
        const currentSection = await SectionModel.findById(id);
        if (currentSection && currentSection.image) {
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
      
      // If we successfully updated with a new image and there was an old image, 
      // try to delete the old one from Cloudinary
      if (oldImageUrl && updateData.image && updateData.image !== oldImageUrl) {
        try {
          // Import dynamically to avoid circular dependency
          const cloudinaryService = (await import('../services/cloudinary.service')).default;
          const publicId = cloudinaryService.getPublicIdFromUrl(oldImageUrl);
          if (publicId) {
            // Delete in the background, don't wait for it
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
      // If this is a duplicate key error, provide a clearer message
      if (error.name === 'MongoServerError' && error.code === 11000) {
        throw new Error(`Another section with the same name already exists for this website`);
      }
      throw error;
    }
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
        {runValidators: true }
      );
      
      if (!section) {
        throw new Error('Section not found');
      }
      
      return section;
    } catch (error) {
      throw error;
    }
  }

  // Delete section
  async deleteSection(id: string) {
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      // Get the section with its image
      const section = await SectionModel.findById(id).session(session);
      if (!section) {
        throw new Error('Section not found');
      }
      
      // Store the image URL for later deletion if it exists
      const imageUrl = section.image;
      
      // Delete the section
      await SectionModel.findByIdAndDelete(id).session(session);
      
      // Find all subsections belonging to this section
      const subsections = await SubSectionModel.find({ sectionId: id }).session(session);
      const subsectionIds = subsections.map(subsection => subsection._id);
      
      // Delete all subsections
      await SubSectionModel.deleteMany({ sectionId: id }).session(session);
      
      // Find all content elements for this section and its subsections
      const elementIds = await ContentElementModel.find({
        $or: [
          { parentType: 'section', parentId: id },
          { parentType: 'subsection', parentId: { $in: subsectionIds } }
        ]
      }).distinct('_id').session(session);
      
      // Delete all content elements
      await ContentElementModel.deleteMany({
        $or: [
          { parentType: 'section', parentId: id },
          { parentType: 'subsection', parentId: { $in: subsectionIds } }
        ]
      }).session(session);
      
      // Delete all content translations
      await ContentTranslationModel.deleteMany({
        elementId: { $in: elementIds }
      }).session(session);
      
      await session.commitTransaction();
      
      // Delete the image from Cloudinary if it exists (after transaction is committed)
      if (imageUrl) {
        try {
          const cloudinaryService = require('../services/cloudinary.service').default;
          const publicId = cloudinaryService.getPublicIdFromUrl(imageUrl);
          if (publicId) {
            // Delete in the background, don't wait for it
            cloudinaryService.deleteImage(publicId).catch(err => {
              console.error('Failed to delete section image:', err);
            });
          }
        } catch (error) {
          console.error('Error importing cloudinary service:', error);
        }
      }
      
      return { message: 'Section deleted successfully' };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
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

      // Build the query based on the websiteId and active status
      const query: any = { WebSiteId: websiteId };
      if (!includeInactive) {
        query.isActive = true;
      }
      
      // Find sections matching the query and sort by order
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
  async checkExistingSections(name: string, websiteId: Schema.Types.ObjectId | string) {
    try {
      
      // Find ALL sections with this name (across all websites)
      const allSectionsWithName = await SectionModel.find({ name });
      
        
      // Find sections with this name for this specific website
      const sectionsForWebsite = await SectionModel.find({ 
        name, 
        WebSiteId: websiteId 
      });
 
      
      // Check if there are any indexes on the collection
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
async  updateSectionOrder(sections: { sectionId: string; newOrder: number; websiteId: Schema.Types.ObjectId | string }[], maxRetries = 3) {
  let attempt = 0;

  while (attempt < maxRetries) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      // Validate inputs
      if (!sections.length) {
        throw new Error('At least one section is required');
      }

      const websiteId = sections[0].websiteId; // Assume all sections belong to the same website
      if (!websiteId) {
        throw new Error('Website ID is required');
      }

      // Validate all sections exist and belong to the website
      const sectionIds = sections.map(s => s.sectionId);
      const existingSections = await SectionModel.find({ 
        _id: { $in: sectionIds }, 
        WebSiteId: websiteId 
      }).session(session);

      if (existingSections.length !== sections.length) {
        throw new Error('One or more sections not found or do not belong to the specified website');
      }

      // Get all sections for the website to determine max order
      const allSections = await SectionModel.find({ WebSiteId: websiteId })
        .sort({ order: 1 })
        .session(session);

      const maxOrder = allSections.length - 1;

      // Validate new order values
      for (const { newOrder } of sections) {
        if (!Number.isInteger(newOrder) || newOrder < 0 || newOrder > maxOrder) {
          throw new Error(`Order value must be between 0 and ${maxOrder}`);
        }
      }

      // Update orders for all sections
      const updates = sections.map(({ sectionId, newOrder }) => ({
        updateOne: {
          filter: { _id: sectionId, WebSiteId: websiteId },
          update: { $set: { order: newOrder } },
        },
      }));

      await SectionModel.bulkWrite(updates, { session });

      // Fetch updated sections
      const updatedSections = await SectionModel.find({ 
        _id: { $in: sectionIds }, 
        WebSiteId: websiteId 
      }).session(session);

      await session.commitTransaction();
      return updatedSections;
    } catch (error: any) {
      await session.abortTransaction();
      
      // Check if the error is a transient transaction error
      if (error.name === 'MongoBulkWriteError' && error.message.includes('Write conflict')) {
        attempt++;
        if (attempt >= maxRetries) {
          throw new Error('Max retries reached for write conflict. Please try again later.');
        }
        // Optional: Add a small delay before retrying to reduce contention
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        continue;
      }
      
      throw error; // Rethrow non-transient errors
    } finally {
      session.endSession();
    }
  }

  throw new Error('Unexpected error: Retry loop exited without resolution');
}
}


