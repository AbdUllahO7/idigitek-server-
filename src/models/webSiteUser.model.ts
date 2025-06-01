import mongoose, { Schema } from 'mongoose';

interface IWebSiteUser {
  userId: Schema.Types.ObjectId;
  webSiteId: Schema.Types.ObjectId;
  role: string; 
  createdAt: Date;
  updatedAt: Date;
}

const webSiteUserSchema = new Schema<IWebSiteUser>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    webSiteId: {
      type: Schema.Types.ObjectId,
      ref: 'WebSite',
      required: true
    },
    role: {
      type: String,
      required: true,
      default: 'editor',
      enum: ['owner' , 'superAdmin' , 'user' , 'admin']
    }
  },
  {
    timestamps: true,
  }
);

// Create a compound index to ensure unique combinations
webSiteUserSchema.index({ userId: 1, webSiteId: 1 }, { unique: true });

const WebSiteUserModel = mongoose.model<IWebSiteUser>('WebSiteUser', webSiteUserSchema);

export default WebSiteUserModel;