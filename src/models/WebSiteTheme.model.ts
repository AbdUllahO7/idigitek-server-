import mongoose, { Schema, Types } from 'mongoose';

// Define the TypeScript interface for WebSiteTheme
export interface WebSiteThemeProps {
    _id?: Types.ObjectId;
    websiteId: Types.ObjectId;
    themeName: string;
    colors: {
        primary: string;
        secondary?: string;
        background: string;
        text: string;
        accent?: string;
        border?: string;
        hover?: string;
        error?: string;
        success?: string;
        warning?: string;
    };
    fonts: {
        heading: {
            family: string;
            weight?: string;
            size?: string;
        };
        body: {
            family: string;
            weight?: string;
            size?: string;
        };
        accent?: {
            family: string;
            weight?: string;
            size?: string;
        };
    };
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const WebSiteThemeSchema = new Schema<WebSiteThemeProps>(
    {
        websiteId: {
            type: Schema.Types.ObjectId,
            ref: 'WebSite',
            required: true,
            index: true,
        },
        themeName: {
            type: String,
            required: true,
            trim: true,
            default: 'Default Theme'
        },
        colors: {
            primary: {
                type: String,
                required: true,
                trim: true,
            },
            secondary: {
                type: String,
                trim: true,
            },
            background: {
                type: String,
                required: true,
                trim: true,
                default: '#ffffff'
            },
            text: {
                type: String,
                required: true,
                trim: true,
                default: '#000000'
            },
            accent: {
                type: String,
                trim: true,
            },
            border: {
                type: String,
                trim: true,
            },
            hover: {
                type: String,
                trim: true,
            },
            error: {
                type: String,
                trim: true,
            },
            success: {
                type: String,
                trim: true,
            },
            warning: {
                type: String,
                trim: true,
            }
        },
        fonts: {
            heading: {
                family: {
                    type: String,
                    required: true,
                    trim: true,
                    default: 'Arial, sans-serif'
                },
                weight: {
                    type: String,
                    trim: true,
                    default: '600'
                },
                size: {
                    type: String,
                    trim: true,
                    default: '24px'
                }
            },
            body: {
                family: {
                    type: String,
                    required: true,
                    trim: true,
                    default: 'Arial, sans-serif'
                },
                weight: {
                    type: String,
                    trim: true,
                    default: '400'
                },
                size: {
                    type: String,
                    trim: true,
                    default: '16px'
                }
            },
            accent: {
                family: {
                    type: String,
                    trim: true,
                },
                weight: {
                    type: String,
                    trim: true,
                },
                size: {
                    type: String,
                    trim: true,
                }
            }
        },
        isActive: {
            type: Boolean,
            default: true,
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Index for better query performance
WebSiteThemeSchema.index({ websiteId: 1, isActive: 1 });
WebSiteThemeSchema.index({ websiteId: 1, themeName: 1 }, { unique: true });

// Virtual field to populate website data
WebSiteThemeSchema.virtual('website', {
    ref: 'WebSite',
    localField: 'websiteId',
    foreignField: '_id',
    justOne: true
});

const WebSiteThemeModel = mongoose.model<WebSiteThemeProps>('WebSiteTheme', WebSiteThemeSchema);

export default WebSiteThemeModel;