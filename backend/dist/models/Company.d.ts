import mongoose, { Document } from 'mongoose';
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
        customDomain?: string;
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
export declare const Company: mongoose.Model<ICompanyDocument, {}, {}, {}, mongoose.Document<unknown, {}, ICompanyDocument, {}, {}> & ICompanyDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Company.d.ts.map