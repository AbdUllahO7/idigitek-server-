import { Schema } from 'mongoose';
import { ILanguages } from './languages.types';

export interface SocialLinks {
  facebook: string;
  instagram: string;
  twitter: string;
  linkedin: string;
}

export interface WebSiteProps {
  name: string;
  description?: string;
  logo?: string;
  sector?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  socialLinks?: SocialLinks;
  businessHours?: string;
  category?: string;
  createdAt?: Date;
  updatedAt?: Date;
  metadata?: any;
  languages?: ILanguages[];
}

export interface WebSiteUserProps {
  userId: Schema.Types.ObjectId;
  webSiteId: Schema.Types.ObjectId;
  role: 'owner' | 'editor' | 'viewer';
  createdAt: Date;
  updatedAt: Date;
}

export interface WebSiteWithUsersProps extends WebSiteProps {
  users: {
    userId: Schema.Types.ObjectId;
    role: string;
  }[];
}