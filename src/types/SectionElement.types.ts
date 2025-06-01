import { Document } from 'mongoose';

export interface ISectionElement extends Document {
    name: string;
    type: 'text' | 'image' | 'icon' | 'gallery' | 'video' | 'link' | 'custom';
    text?: string;
    image?: string;
    icon?: string[];
    images?: string[];
    url?: string;
    customData?: any;
    isActive: boolean;
    order: number;
    createdAt: Date;
    updatedAt: Date;
}