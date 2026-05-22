import mongoose, { Schema, Document } from 'mongoose';

export interface IPipelineStage {
  id: string;
  label: string;
  order: number;
  color: string;
  emailTemplateId?: mongoose.Types.ObjectId | null;
}

export interface ICompanyDocument extends Document {
  name: string;
  slug: string;
  email: string;
  phone?: string;
  website?: string;
  logo?: string;
  description?: string;
  industry?: string;
  size?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    faviconUrl?: string;
  };
  settings?: {
    enableProctoring?: boolean;
    enableNaukriIntegration?: boolean;
    enableLinkedInIntegration?: boolean;
    dataRetentionDays?: number;
    timezone?: string;
    dateFormat?: string;
    currency?: string;
    language?: string;
  };
  defaultPipelineStages?: IPipelineStage[];
  notifications?: {
    emailOnNewApplication?: boolean;
    emailOnStageChange?: boolean;
    smsEnabled?: boolean;
    dailyDigest?: boolean;
  };
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const companySchema = new Schema<ICompanyDocument>(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Company slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'],
    },
    email: {
      type: String,
      required: [true, 'Company email is required'],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    logo: {
      type: String,
    },
    description: {
      type: String,
    },
    industry: {
      type: String,
    },
    size: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String,
    },
    settings: {
      enableProctoring: {
        type: Boolean,
        default: true,
      },
      enableNaukriIntegration: {
        type: Boolean,
        default: false,
      },
      enableLinkedInIntegration: {
        type: Boolean,
        default: false,
      },
      dataRetentionDays: {
        type: Number,
        default: 365,
      },
      timezone: { type: String, default: 'Asia/Kolkata' },
      dateFormat: { type: String, default: 'DD/MM/YYYY' },
      currency: { type: String, default: 'INR' },
      language: { type: String, default: 'en' },
    },
    branding: {
      logoUrl: String,
      primaryColor: { type: String, default: '#4f46e5' },
      faviconUrl: String,
    },
    defaultPipelineStages: {
      type: [{
        id: { type: String, required: true },
        label: { type: String, required: true },
        order: { type: Number, required: true },
        color: { type: String, default: '#6366f1' },
        emailTemplateId: { type: Schema.Types.ObjectId, ref: 'EmailTemplate', default: null },
      }],
      default: [
        { id: 'applied', label: 'Applied', order: 0, color: '#6366f1' },
        { id: 'screening', label: 'Screening', order: 1, color: '#f59e0b' },
        { id: 'interview', label: 'Interview', order: 2, color: '#3b82f6' },
        { id: 'offer', label: 'Offer', order: 3, color: '#10b981' },
        { id: 'hired', label: 'Hired', order: 4, color: '#22c55e' },
      ],
    },
    notifications: {
      emailOnNewApplication: { type: Boolean, default: true },
      emailOnStageChange: { type: Boolean, default: true },
      smsEnabled: { type: Boolean, default: false },
      dailyDigest: { type: Boolean, default: false },
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'pending_verification'],
      default: 'pending_verification',
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

companySchema.index({ name: 1, deletedAt: 1 });
companySchema.index({ slug: 1, deletedAt: 1 });

export const Company = mongoose.model<ICompanyDocument>('Company', companySchema);
