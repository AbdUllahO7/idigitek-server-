import { Schema } from 'mongoose';

export interface IUserSection {
  _id: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  sectionId: Schema.Types.ObjectId;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserSectionPopulated {
  _id: Schema.Types.ObjectId;
  userId: {
    _id: Schema.Types.ObjectId;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  sectionId: {
    _id: Schema.Types.ObjectId;
    name: string;
    description: string;
    isActive: boolean;
    order: number;
  };
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}