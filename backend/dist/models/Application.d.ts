import mongoose, { Document } from 'mongoose';
import { ApplicationStatus } from '../types';
interface IStatusHistory {
    status: ApplicationStatus;
    changedBy: mongoose.Types.ObjectId;
    changedAt: Date;
    remarks?: string;
}
export interface IApplicationDocument extends Document {
    jobId: mongoose.Types.ObjectId;
    candidateId: mongoose.Types.ObjectId;
    companyId: mongoose.Types.ObjectId;
    resumeUrl?: string;
    coverLetter?: string;
    expectedSalary?: number;
    currentSalary?: number;
    preferredLocation?: string;
    currentLocation?: string;
    status: ApplicationStatus;
    statusHistory: IStatusHistory[];
    skillMatchScore?: number;
    experienceMatchScore?: number;
    overallScore?: number;
    appliedAt: Date;
    shortlistedAt?: Date;
    rejectedAt?: Date;
    hiredAt?: Date;
    rejectionReason?: string;
    notes?: Array<{
        addedBy: mongoose.Types.ObjectId;
        note: string;
        createdAt: Date;
    }>;
    source: 'direct' | 'naukri' | 'linkedin' | 'referral';
    referralBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
    parsedSkills: string[];
    parsedExperienceYears?: number;
    parsedEducation: Array<{
        degree: string;
        institution: string;
        year?: number;
    }>;
    parsedNoticePeriod?: string;
    parsedAt?: Date;
    parsedCurrentRole?: string;
    parsedCurrentCompany?: string;
    parsedWorkHistory: Array<{
        company: string;
        role: string;
        durationMonths?: number;
        highlights: string[];
    }>;
    missingSkills: string[];
    matchingSkills: string[];
    aiFitSummary?: string;
}
export declare const Application: mongoose.Model<IApplicationDocument, {}, {}, {}, mongoose.Document<unknown, {}, IApplicationDocument, {}, {}> & IApplicationDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export {};
//# sourceMappingURL=Application.d.ts.map