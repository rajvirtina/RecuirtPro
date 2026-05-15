import mongoose, { Document } from 'mongoose';
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
    settings?: {
        enableProctoring?: boolean;
        enableNaukriIntegration?: boolean;
        enableLinkedInIntegration?: boolean;
        dataRetentionDays?: number;
    };
    emailVerified: boolean;
    emailVerificationToken?: string;
    emailVerificationExpires?: Date;
    status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}
export declare const Company: mongoose.Model<ICompanyDocument, {}, {}, {}, mongoose.Document<unknown, {}, ICompanyDocument, {}, {}> & ICompanyDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Company.d.ts.map