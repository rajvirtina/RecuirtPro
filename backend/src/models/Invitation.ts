import mongoose, { Schema, Document } from 'mongoose';

export interface IInvitationDocument extends Document {
  email: string;
  companyId: mongoose.Types.ObjectId;
  invitedBy: mongoose.Types.ObjectId;
  token: string;
  role: 'candidate';
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invitationSchema = new Schema<IInvitationDocument>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    role: {
      type: String,
      default: 'candidate',
      enum: ['candidate'],
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired'],
      default: 'pending',
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    acceptedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
invitationSchema.index({ email: 1, companyId: 1 });
invitationSchema.index({ token: 1 });
invitationSchema.index({ status: 1, expiresAt: 1 });

export const Invitation = mongoose.model<IInvitationDocument>('Invitation', invitationSchema);
