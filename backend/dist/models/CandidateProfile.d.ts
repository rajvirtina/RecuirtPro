import mongoose, { Document } from 'mongoose';
import { ISkill, IEducation, IWorkExperience, IResumeSource } from '../types';
export interface ICandidateProfileDocument extends Document {
    userId: mongoose.Types.ObjectId;
    resumeUrl?: string;
    resumeFileName?: string;
    skills: ISkill[];
    totalExperience: number;
    currentSalary?: number;
    expectedSalary?: number;
    currency: string;
    noticePeriod?: number;
    availableFrom?: Date;
    education: IEducation[];
    workExperience: IWorkExperience[];
    certifications?: Array<{
        name: string;
        issuingOrganization: string;
        issueDate?: Date;
        expiryDate?: Date;
        credentialId?: string;
    }>;
    languages?: Array<{
        name: string;
        proficiency: 'basic' | 'conversational' | 'fluent' | 'native';
    }>;
    linkedinUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
    source: IResumeSource;
    parsedData?: any;
    lastUpdated: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const CandidateProfile: mongoose.Model<ICandidateProfileDocument, {}, {}, {}, mongoose.Document<unknown, {}, ICandidateProfileDocument, {}, {}> & ICandidateProfileDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=CandidateProfile.d.ts.map