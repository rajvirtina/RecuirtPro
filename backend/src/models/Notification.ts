import mongoose, { Schema, Document } from 'mongoose';
import { NotificationType } from '../types';

export interface INotificationDocument extends Document {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  readAt?: Date;
  sentAt?: Date;
  emailSent: boolean;
  smsSent: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotificationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: Schema.Types.Mixed,
    read: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
    sentAt: Date,
    emailSent: {
      type: Boolean,
      default: false,
    },
    smsSent: {
      type: Boolean,
      default: false,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    expiresAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Notification = mongoose.model<INotificationDocument>(
  'Notification',
  notificationSchema
);
