import { Types } from 'mongoose';
import WebSiteModel from '../models/WebSite.model';
import WebSiteThemeModel, { WebSiteThemeProps } from '../models/WebSiteTheme.model';


export class WebSiteThemeService {
    // Create a new theme for a website
    async createTheme(themeData: Partial<WebSiteThemeProps>): Promise<WebSiteThemeProps> {
        try {
            // Validate website exists
            if (!Types.ObjectId.isValid(themeData.websiteId as unknown as string)) {
                throw new Error('Invalid website ID');
            }

            const websiteExists = await WebSiteModel.findById(themeData.websiteId);
            if (!websiteExists) {
                throw new Error('Website not found');
            }

            // If this is set as active, deactivate other themes for this website
            if (themeData.isActive) {
                await WebSiteThemeModel.updateMany(
                    { websiteId: themeData.websiteId },
                    { isActive: false }
                );
            }

            const theme = new WebSiteThemeModel(themeData);
            return await theme.save();
        } catch (error) {
            throw new Error(`Error creating theme: ${error.message}`);
        }
    }

    // Get all themes for a specific website
    async getThemesByWebSiteId(websiteId: string): Promise<WebSiteThemeProps[]> {
        try {
            if (!Types.ObjectId.isValid(websiteId)) {
                throw new Error('Invalid website ID');
            }

            return await WebSiteThemeModel
                .find({ websiteId })
                .populate('website')
                .sort({ createdAt: -1 });
        } catch (error) {
            throw new Error(`Error fetching themes: ${error.message}`);
        }
    }

    // Get active theme for a website
    async getActiveTheme(websiteId: string): Promise<WebSiteThemeProps | null> {
        try {
            if (!Types.ObjectId.isValid(websiteId)) {
                throw new Error('Invalid website ID');
            }
            console.log("theme : " , websiteId)

            return await WebSiteThemeModel
                .findOne({ websiteId, isActive: true })
                .populate('website');
        } catch (error) {
            throw new Error(`Error fetching active theme: ${error.message}`);
        }
    }

    // Get theme by ID
    async getThemeById(themeId: string): Promise<WebSiteThemeProps | null> {
        try {
            if (!Types.ObjectId.isValid(themeId)) {
                throw new Error('Invalid theme ID');
            }

            return await WebSiteThemeModel
                .findById(themeId)
                .populate('website');
        } catch (error) {
            throw new Error(`Error fetching theme: ${error.message}`);
        }
    }

    // Update theme
    async updateTheme(themeId: string, updateData: Partial<WebSiteThemeProps>): Promise<WebSiteThemeProps | null> {
        try {
            if (!Types.ObjectId.isValid(themeId)) {
                throw new Error('Invalid theme ID');
            }

            const theme = await WebSiteThemeModel.findById(themeId);
            if (!theme) {
                throw new Error('Theme not found');
            }

            // If setting as active, deactivate other themes for this website
            if (updateData.isActive === true) {
                await WebSiteThemeModel.updateMany(
                    { websiteId: theme.websiteId, _id: { $ne: themeId } },
                    { isActive: false }
                );
            }

            return await WebSiteThemeModel
                .findByIdAndUpdate(themeId, updateData, { new: true, runValidators: true })
                .populate('website');
        } catch (error) {
            throw new Error(`Error updating theme: ${error.message}`);
        }
    }

    // Update theme colors only
    async updateThemeColors(themeId: string, colors: Partial<WebSiteThemeProps['colors']>): Promise<WebSiteThemeProps | null> {
        try {
            if (!Types.ObjectId.isValid(themeId)) {
                throw new Error('Invalid theme ID');
            }

            const updateData: any = {};
            Object.keys(colors).forEach(key => {
                updateData[`colors.${key}`] = colors[key as keyof typeof colors];
            });

            return await WebSiteThemeModel
                .findByIdAndUpdate(themeId, { $set: updateData }, { new: true })
                .populate('website');
        } catch (error) {
            throw new Error(`Error updating theme colors: ${error.message}`);
        }
    }

    // Update theme fonts only
    async updateThemeFonts(themeId: string, fonts: Partial<WebSiteThemeProps['fonts']>): Promise<WebSiteThemeProps | null> {
        try {
            if (!Types.ObjectId.isValid(themeId)) {
                throw new Error('Invalid theme ID');
            }

            const updateData: any = {};
            
            if (fonts.heading) {
                Object.keys(fonts.heading).forEach(key => {
                    updateData[`fonts.heading.${key}`] = fonts.heading![key as keyof typeof fonts.heading];
                });
            }
            
            if (fonts.body) {
                Object.keys(fonts.body).forEach(key => {
                    updateData[`fonts.body.${key}`] = fonts.body![key as keyof typeof fonts.body];
                });
            }
            
            if (fonts.accent) {
                Object.keys(fonts.accent).forEach(key => {
                    updateData[`fonts.accent.${key}`] = fonts.accent![key as keyof typeof fonts.accent];
                });
            }

            return await WebSiteThemeModel
                .findByIdAndUpdate(themeId, { $set: updateData }, { new: true })
                .populate('website');
        } catch (error) {
            throw new Error(`Error updating theme fonts: ${error.message}`);
        }
    }

    // Set active theme (deactivate others)
    async setActiveTheme(websiteId: string, themeId: string): Promise<WebSiteThemeProps | null> {
        try {
            if (!Types.ObjectId.isValid(websiteId) || !Types.ObjectId.isValid(themeId)) {
                throw new Error('Invalid website or theme ID');
            }

            // Verify theme belongs to the website
            const theme = await WebSiteThemeModel.findOne({ _id: themeId, websiteId });
            if (!theme) {
                throw new Error('Theme not found for this website');
            }

            // Deactivate all themes for this website
            await WebSiteThemeModel.updateMany(
                { websiteId },
                { isActive: false }
            );

            // Activate the selected theme
            return await WebSiteThemeModel
                .findByIdAndUpdate(themeId, { isActive: true }, { new: true })
                .populate('website');
        } catch (error) {
            throw new Error(`Error setting active theme: ${error.message}`);
        }
    }

    // Delete theme
    async deleteTheme(themeId: string): Promise<boolean> {
        try {
            if (!Types.ObjectId.isValid(themeId)) {
                throw new Error('Invalid theme ID');
            }

            const theme = await WebSiteThemeModel.findById(themeId);
            if (!theme) {
                throw new Error('Theme not found');
            }

            // If deleting active theme, make another theme active
            if (theme.isActive) {
                const otherTheme = await WebSiteThemeModel.findOne({
                    websiteId: theme.websiteId,
                    _id: { $ne: themeId }
                });
                
                if (otherTheme) {
                    await WebSiteThemeModel.findByIdAndUpdate(
                        otherTheme._id,
                        { isActive: true }
                    );
                }
            }

            const result = await WebSiteThemeModel.findByIdAndDelete(themeId);
            return !!result;
        } catch (error) {
            throw new Error(`Error deleting theme: ${error.message}`);
        }
    }

    // Clone theme
    async cloneTheme(themeId: string, newThemeName: string): Promise<WebSiteThemeProps> {
        try {
            if (!Types.ObjectId.isValid(themeId)) {
                throw new Error('Invalid theme ID');
            }

            const originalTheme = await WebSiteThemeModel.findById(themeId);
            if (!originalTheme) {
                throw new Error('Theme not found');
            }

            const clonedThemeData = {
                websiteId: originalTheme.websiteId,
                themeName: newThemeName,
                colors: originalTheme.colors,
                fonts: originalTheme.fonts,
                isActive: false
            };

            const clonedTheme = new WebSiteThemeModel(clonedThemeData);
            return await clonedTheme.save();
        } catch (error) {
            throw new Error(`Error cloning theme: ${error.message}`);
        }
    }

    // Get all themes (admin function)
    async getAllThemes(page: number = 1, limit: number = 10): Promise<{
        themes: WebSiteThemeProps[];
        total: number;
        totalPages: number;
        currentPage: number;
    }> {
        try {
            const skip = (page - 1) * limit;
            const themes = await WebSiteThemeModel
                .find()
                .populate('website')
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 });

            const total = await WebSiteThemeModel.countDocuments();
            const totalPages = Math.ceil(total / limit);

            return {
                themes,
                total,
                totalPages,
                currentPage: page
            };
        } catch (error) {
            throw new Error(`Error fetching all themes: ${error.message}`);
        }
    }
}