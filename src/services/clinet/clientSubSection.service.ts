import { ICreateSubSection } from "src/types/sub.section.types";
import mongoose from 'mongoose';
import { AppError } from "../../middleware/errorHandler.middleware";
import SubSectionModel from "../../models/subSections.model";
import ContentTranslationModel from "../../models/ContentTranslation.model";
import ContentElementModel from "../../models/ContentElement.model";

class ClientSubSectionServicer {
  /**
   * Get main subsection for a given section
   * @param sectionId The section ID
   * @returns Promise with the main subsection for this section, or null if not found
   */
  async getMainSubSectionBySectionId(sectionId: string): Promise<ICreateSubSection | null> {
    try {
      if (!sectionId) {
        throw AppError.validation('Section ID is required');
      }
      console.log("getMainSubSectionBySectionId: sectionId", sectionId);
      if (!mongoose.Types.ObjectId.isValid(sectionId)) {
        throw AppError.validation('Invalid section ID format');
      }

      const mainSubsection = await SubSectionModel.findOne({
        section: sectionId,
        isMain: true,
        isActive: true
      })
        .populate({
          path: 'sectionItem',
          populate: {
            path: 'section'
          }
        })
        .populate('section')
        .populate('languages');

      console.log("getMainSubSectionBySectionId: result", mainSubsection);
      return mainSubsection;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to retrieve main subsection', error);
    }
  }

  /**
   * Get subsections by section ID with all content elements and their translations
   * @param sectionId The section ID
   * @param activeOnly Whether to return only active subsections
   * @param limit Maximum number of subsections to return
   * @param skip Number of subsections to skip
   * @returns Promise with array of complete subsections data including elements and translations
   */
  async getCompleteSubSectionsBySectionId(
    sectionId: string,
    activeOnly = true,
    limit = 100,
    skip = 0
  ): Promise<any[]> {
    try {
      if (!sectionId) {
        throw AppError.validation('Section ID is required');
      }
      console.log("getCompleteSubSectionsBySectionId: sectionId", sectionId);
      if (!mongoose.Types.ObjectId.isValid(sectionId)) {
        throw AppError.validation('Invalid section ID format');
      }

      const query: any = { section: sectionId };
      if (activeOnly) {
        query.isActive = true;
      }

      const subsections = await SubSectionModel.find(query)
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'sectionItem',
          populate: {
            path: 'section'
          },
          match: activeOnly ? { isActive: true } : {}
        })
        .populate('section')
        .populate('languages');

      console.log("getCompleteSubSectionsBySectionId: subsections", subsections.length);

      if (subsections.length === 0) {
        return [];
      }

      const subsectionIds = subsections.map(sub => sub._id);
      console.log("getCompleteSubSectionsBySectionId: subsectionIds", subsectionIds);

      const contentElements = await ContentElementModel.find({
        parent: { $in: subsectionIds },
        isActive: activeOnly
      }).sort({ order: 1 });

      console.log("getCompleteSubSectionsBySectionId: contentElements", contentElements.length);

      const elementIds = contentElements.map(element => element._id);

      const translations = await ContentTranslationModel.find({
        contentElement: { $in: elementIds },
        isActive: activeOnly
      }).populate('language');

      console.log("getCompleteSubSectionsBySectionId: translations", translations.length);

      const translationsByElement: Record<string, any[]> = {};
      translations.forEach(translation => {
        const elementId = translation.contentElement.toString();
        if (!translationsByElement[elementId]) {
          translationsByElement[elementId] = [];
        }
        translationsByElement[elementId].push(translation);
      });

      const elementsBySubsection: Record<string, any[]> = {};
      contentElements.forEach(element => {
        const subsectionId = element.parent.toString();
        if (!elementsBySubsection[subsectionId]) {
          elementsBySubsection[subsectionId] = [];
        }
        const elementData = element.toObject();
        const elementId = element._id.toString();
        elementData.translations = translationsByElement[elementId] || [];
        elementsBySubsection[subsectionId].push(elementData);
      });

      const result = subsections.map(subsection => {
        const subsectionData = subsection.toObject();
        const subsectionId = subsection._id.toString();
        subsectionData.elements = elementsBySubsection[subsectionId] || [];
        return subsectionData;
      });

      console.log("getCompleteSubSectionsBySectionId: result", result.length);
      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.database('Failed to retrieve complete subsections by section ID', error);
    }
  }

  /**
   * Get subsections by section item ID with all content elements and their translations
   * @param sectionItemId The section item ID
   * @param activeOnly Whether to return only active subsections
   * @param limit Maximum number of subsections to return
   * @param skip Number of subsections to skip
   * @returns Promise with array of complete subsections data including elements and translations
   */
    async getSubSectionsBySectionItemId(
    sectionItemId: string,
    activeOnly = true,
    limit = 100,
    skip = 0,
    includeContentCount: boolean
  ): Promise<any[]> {
    try {
      if (!sectionItemId) {
        throw AppError.validation('Section Item ID is required');
      }
      console.log("getSubSectionsBySectionItemId: sectionItemId", sectionItemId);
      if (!mongoose.Types.ObjectId.isValid(sectionItemId)) {
        throw AppError.validation('Invalid section item ID format');
      }

      const query: any = { sectionItem: sectionItemId };
      if (activeOnly) {
        query.isActive = true;
      }

      const subsections = await SubSectionModel.find(query)
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'sectionItem',
          populate: {
            path: 'section'
          },
          match: activeOnly ? { isActive: true } : {}
        })
        .populate('languages');

      console.log("getSubSectionsBySectionItemId: subsections", subsections.length);

      if (subsections.length === 0) {
        return [];
      }

      const subsectionIds = subsections.map(sub => sub._id);
      console.log("getSubSectionsBySectionItemId: subsectionIds", subsectionIds);

      const contentElements = await ContentElementModel.find({
        parent: { $in: subsectionIds },
        isActive: activeOnly
      }).sort({ order: 1 });

      console.log("getSubSectionsBySectionItemId: contentElements", contentElements.length);

      const elementIds = contentElements.map(element => element._id);

      const translations = await ContentTranslationModel.find({
        contentElement: { $in: elementIds },
        isActive: activeOnly
      }).populate('language');

      console.log("getSubSectionsBySectionItemId: translations", translations.length);

      const translationsByElement: Record<string, any[]> = {};
      translations.forEach(translation => {
        const elementId = translation.contentElement.toString();
        if (!translationsByElement[elementId]) {
          translationsByElement[elementId] = [];
        }
        translationsByElement[elementId].push(translation);
      });

      const elementsBySubsection: Record<string, any[]> = {};
      contentElements.forEach(element => {
        const subsectionId = element.parent.toString();
        if (!elementsBySubsection[subsectionId]) {
          elementsBySubsection[subsectionId] = [];
        }
        const elementData = element.toObject();
        const elementId = element._id.toString();
        elementData.translations = translationsByElement[elementId] || [];
        elementsBySubsection[subsectionId].push(elementData);
      });

        const result = subsections.map(subsection => {
            const subsectionData = subsection.toObject();
            const subsectionId = subsection._id.toString();
            subsectionData.elements = elementsBySubsection[subsectionId] || [];
            if (includeContentCount) {
            subsectionData.contentCount = (subsectionData.elements || []).length;
            }
            return subsectionData;
        });

        console.log("getSubSectionsBySectionItemId: result", result.length);
        return result;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw AppError.database('Failed to retrieve complete subsections by section item ID', error);
    }
    }

    /**
     * Get main subsection for a given WebSite
     * @param websiteId The WebSite ID
     * @returns Promise with the main subsection for this WebSite, or null if not found
     */
    async getMainSubSectionByWebSiteId(websiteId: string): Promise<ICreateSubSection | null> {
        try {
        if (!websiteId) {
            throw AppError.validation('Website ID is required');
        }
        console.log("getMainSubSectionByWebSiteId: websiteId", websiteId);
        if (!mongoose.Types.ObjectId.isValid(websiteId)) {
            throw AppError.validation('Invalid WebSite ID format');
        }

        const mainSubsection = await SubSectionModel.findOne({
            WebSiteId: websiteId,
            isMain: true,
            isActive: true
        })
            .populate({
            path: 'sectionItem',
            populate: {
                path: 'section'
            }
            })
            .populate('section')
            .populate('languages');

        console.log("getMainSubSectionByWebSiteId: result", mainSubsection);
        return mainSubsection;
        } catch (error) {
        if (error instanceof AppError) throw error;
        throw AppError.database('Failed to retrieve main subsection for WebSite', error);
        }
    }
}

export default new ClientSubSectionServicer();