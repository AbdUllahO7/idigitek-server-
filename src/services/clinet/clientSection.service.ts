import mongoose, { Schema } from "mongoose";
import ContentElementModel from "../../models/ContentElement.model";
import ContentTranslationModel from "../../models/ContentTranslation.model";
import SectionItemModel from "../../models/sectionItems.model";
import SectionModel from "../../models/sections.model";
import SubSectionModel from "../../models/subSections.model";

export class ClientSectionService {
    async getAllSectionsWithData(query: any = {}, includeInactive: boolean = false, languageId?: string) {
        try {
            // 1. Fetch all sections
            console.log("Fetching sections with query:", query);
            const sections = await SectionModel.find(query).sort({ order: 1 });
            console.log(`Found ${sections.length} sections`);

            if (!sections.length) {
                console.log("No sections found for query:", query);
                return [];
            }

            // 2. Fetch all section items
            const sectionIds = sections.map(section => section._id);
            const itemQuery: any = { section: { $in: sectionIds } };
            if (!includeInactive) {
                itemQuery.isActive = true;
            }

            console.log("Fetching section items with query:", itemQuery);
            const allSectionItems = await SectionItemModel.find(itemQuery).sort({ order: 1 });
            console.log(`Found ${allSectionItems.length} section items`);

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

            console.log("Fetching subsections with query:", subsectionQuery);
            const allSubsections = await SubSectionModel.find(subsectionQuery).sort({ order: 1 });
            console.log(`Found ${allSubsections.length} subsections`);

            // Group subsections by section item
            const subsectionsByItem = allSubsections.reduce((acc: Record<string, any[]>, subsection) => {
                const itemId = subsection.sectionItem.toString();
                if (!acc[itemId]) {
                    acc[itemId] = [];
                }
                acc[itemId].push(subsection);
                return acc;
            }, {});

            // 4. Fetch content elements and translations if languageId is provided
            let translationsMap: Record<string, any> = {};
            let elementsByParent: Record<string, any[]> = {};

            if (languageId) {
                // Fetch all content elements for subsections
                const subsectionIds = allSubsections.map(sub => sub._id);
                console.log("Fetching content elements for subsection IDs:", subsectionIds);
                const contentElements = await ContentElementModel.find({
                    parent: { $in: subsectionIds },
                }).sort({ order: 1 });
                console.log(`Found ${contentElements.length} content elements`);

                // Group content elements by parent (subsection)
                elementsByParent = contentElements.reduce((acc: Record<string, any[]>, element) => {
                    const parentId = element.parent.toString();
                    if (!acc[parentId]) {
                        acc[parentId] = [];
                    }
                    acc[parentId].push(element);
                    return acc;
                }, {});

                // Fetch translations for content elements
                const contentElementIds = contentElements.map(el => el._id);
                console.log("Fetching translations for content element IDs:", contentElementIds);
                const translations = await ContentTranslationModel.find({
                    contentElement: { $in: contentElementIds },
                    language: languageId,
                });
                console.log(`Found ${translations.length} translations`);

                // Map translations to their content elements
                translationsMap = translations.reduce((map, trans) => {
                    map[trans.contentElement.toString()] = trans.content;
                    return map;
                }, {} as Record<string, any>);
            } else {
                console.log("No languageId provided, skipping content elements and translations");
            }

            // 5. Build complete structure with all data
            const sectionsWithItems = sections.map(section => {
                const sectionId = section._id.toString();
                const items = itemsBySection[sectionId] || [];

                // Add subsections, content elements, and translations to each item
                const itemsWithSubsections = items.map(item => {
                    const itemId = item._id.toString();
                    const subsections = subsectionsByItem[itemId] || [];

                    // Add content elements and translations to subsections
                    const subsectionsWithContent = subsections.map(subsection => {
                        const subsectionId = subsection._id.toString();
                        const elements = (elementsByParent[subsectionId] || []).map(element => ({
                            ...element.toObject(),
                            value: translationsMap[element._id.toString()] || null,
                        }));

                        return {
                            ...subsection.toObject(),
                            elements,
                        };
                    });

                    return {
                        ...item.toObject(),
                        subsections: subsectionsWithContent,
                    };
                });

                return {
                    ...section.toObject(),
                    sectionItems: itemsWithSubsections,
                };
            });

            console.log("Returning sections with items:", sectionsWithItems);
            return sectionsWithItems;
        } catch (error) {
            console.error("Error in getAllSectionsWithData:", error);
            throw error;
        }
    }

    async getSectionsWithDataByWebsiteId(
        websiteId: Schema.Types.ObjectId | string,
        includeInactive: boolean = false,
        languageId?: string
    ) {
        try {
            if (!websiteId) {
                throw new Error('Website ID is required');
            }

            // Build query for sections by website
            const query: { WebSiteId: Schema.Types.ObjectId | string; isActive?: boolean } = { WebSiteId: websiteId };
            if (!includeInactive) {
                query.isActive = true;
            }

            console.log("Fetching sections for websiteId:", websiteId, "with query:", query);
            // Use getAllSectionsWithData to fetch sections and related data
            const sectionsWithData = await this.getAllSectionsWithData(query, includeInactive, languageId);

            console.log("Sections with data for websiteId:", websiteId, ":", sectionsWithData);
            return sectionsWithData;
        } catch (error) {
            console.error("Error in getSectionsWithDataByWebsiteId:", error);
            throw error;
        }
    }

    async getSectionWithContent(id: string, languageId: string) {
        try {
            console.log("Fetching section with ID:", id);
            const section = await SectionModel.findById(id);
            if (!section) {
                console.log("Section not found for ID:", id);
                throw new Error('Section not found');
            }

            // Get all section items for this section
            console.log("Fetching section items for section ID:", id);
            const sectionItems = await SectionItemModel.find({ section: id, isActive: true }).sort({ order: 1 });
            console.log(`Found ${sectionItems.length} section items`);

            // Get all subsections for these section items
            const sectionItemIds = sectionItems.map(item => item._id);
            console.log("Fetching subsections for section item IDs:", sectionItemIds);
            const subsections = await SubSectionModel.find({
                sectionItem: { $in: sectionItemIds },
                isActive: true,
            }).sort({ order: 1 });
            console.log(`Found ${subsections.length} subsections`);

            // Get all content elements for subsections
            const subsectionIds = subsections.map(sub => sub._id);
            console.log("Fetching content elements for subsection IDs:", subsectionIds);
            const contentElements = await ContentElementModel.find({
                parent: { $in: subsectionIds },
            }).sort({ order: 1 });
            console.log(`Found ${contentElements.length} content elements`);

            // Get translations for content elements
            const contentElementIds = contentElements.map(el => el._id);
            console.log("Fetching translations for content element IDs:", contentElementIds, "and languageId:", languageId);
            const translations = await ContentTranslationModel.find({
                contentElement: { $in: contentElementIds },
                language: languageId,
            });
            console.log(`Found ${translations.length} translations`);

            // Map translations to content elements
            const translationsMap = translations.reduce((map, trans) => {
                map[trans.contentElement.toString()] = trans.content;
                return map;
            }, {} as Record<string, any>);

            // Build subsections with content elements and translations
            const subsectionsWithContent = subsections.map(subsection => {
                const subsectionId = subsection._id.toString();
                const elements = contentElements
                    .filter(el => el.parent.toString() === subsectionId)
                    .map(element => ({
                        ...element.toObject(),
                        value: translationsMap[element._id.toString()] || null,
                    }));

                return {
                    ...subsection.toObject(),
                    elements,
                };
            });

            // Build section items with subsections
            const itemsWithSubsections = sectionItems.map(item => {
                const itemId = item._id.toString();
                return {
                    ...item.toObject(),
                    subsections: subsectionsWithContent.filter(sub => sub.sectionItem.toString() === itemId),
                };
            });

            const result = {
                ...section.toObject(),
                sectionItems: itemsWithSubsections,
            };
            console.log("Returning section with content:", result);
            return result;
        } catch (error) {
            console.error("Error in getSectionWithContent:", error);
            throw error;
        }
    }
}