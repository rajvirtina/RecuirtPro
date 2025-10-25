import mongoose, { Schema, Document } from 'mongoose';

export interface ICompanyDocument extends Document {
  name: string;
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
  settings?: {
    enableProctoring?: boolean;
    enableNaukriIntegration?: boolean;
    enableLinkedInIntegration?: boolean;
    dataRetentionDays?: number;
  };
  status: 'active' | 'inactive' | 'suspended';
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
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
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

export const Company = mongoose.model<ICompanyDocument>('Company', companySchema);
