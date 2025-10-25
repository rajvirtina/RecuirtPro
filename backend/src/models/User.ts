import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config';
import { UserRole, UserStatus } from '../types';

export interface IUserDocument extends Document {
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  firstName: string;
  lastName: string;
  phone?: string;
  timezone: string;
  companyId?: mongoose.Types.ObjectId;
  profileImage?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  mfaEnabled: boolean;
  mfaSecret?: string;
  lastLogin?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAuthToken(): string;
  generateRefreshToken(): string;
  getFullName(): string;
}

interface IUserModel extends Model<IUserDocument> {
  findByCredentials(email: string, password: string): Promise<IUserDocument>;
  verifyRefreshToken(token: string): Promise<any>;
}

const userSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.CANDIDATE,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.PENDING_VERIFICATION,
      required: true,
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    profileImage: {
      type: String,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaSecret: {
      type: String,
      select: false,
    },
    lastLogin: {
      type: Date,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
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

// Index for better query performance
userSchema.index({ email: 1, deletedAt: 1 });
userSchema.index({ companyId: 1, role: 1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method: Compare password
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method: Generate auth token
userSchema.methods.generateAuthToken = function (): string {
  return jwt.sign(
    { 
      id: this._id,
      email: this.email,
      role: this.role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expire } as any
  );
};

// Instance method: Generate refresh token
userSchema.methods.generateRefreshToken = function (): string {
  return jwt.sign(
    { 
      id: this._id,
      type: 'refresh',
    },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpire } as any
  );
};

// Instance method: Get full name
userSchema.methods.getFullName = function (): string {
  return `${this.firstName} ${this.lastName}`;
};

// Static method: Find by credentials
userSchema.statics.findByCredentials = async function (
  email: string,
  password: string
): Promise<IUserDocument> {
  const user = await this.findOne({ 
    email,
    deletedAt: null,
  }).select('+password');
  
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  const isPasswordMatch = await user.comparePassword(password);
  
  if (!isPasswordMatch) {
    throw new Error('Invalid credentials');
  }
  
  if (user.status !== UserStatus.ACTIVE) {
    throw new Error('Account is not active');
  }
  
  return user;
};

// Static method: Verify refresh token
userSchema.statics.verifyRefreshToken = async function (token: string): Promise<any> {
  return jwt.verify(token, config.jwt.refreshSecret);
};

// Soft delete - don't actually remove, just mark as deleted
userSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  this.status = UserStatus.INACTIVE;
  return this.save();
};

export const User = mongoose.model<IUserDocument, IUserModel>('User', userSchema);
