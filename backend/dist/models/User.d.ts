import mongoose, { Document, Model } from 'mongoose';
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
    isSuperAdminUser: boolean;
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
    refreshTokenVersion: number;
    comparePassword(candidatePassword: string): Promise<boolean>;
    generateAuthToken(): string;
    generateRefreshToken(): string;
    getFullName(): string;
    invalidateRefreshTokens(): Promise<void>;
}
interface IUserModel extends Model<IUserDocument> {
    findByCredentials(email: string, password: string): Promise<IUserDocument>;
    verifyRefreshToken(token: string): Promise<any>;
}
export declare const User: IUserModel;
export {};
//# sourceMappingURL=User.d.ts.map