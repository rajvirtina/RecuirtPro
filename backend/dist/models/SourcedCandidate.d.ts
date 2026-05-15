import mongoose, { Document } from 'mongoose';
import { SourcingPlatform } from '../types';
export interface ISourcedCandidateDocument extends Document {
    companyId: mongoose.Types.ObjectId;
    sourcedBy: mongoose.Types.ObjectId;
    jobId?: mongoose.Types.ObjectId;
    platform: SourcingPlatform;
    externalId: string;
    name: string;
    email?: string;
    phone?: string;
    location?: string;
    currentCompany?: string;
    currentPosition?: string;
    experience?: number;
    skills: string[];
    education?: string[];
    summary?: string;
    profileUrl?: string;
    resumeUrl?: string;
    imageUrl?: string;
    lastActive?: Date;
    matchScore: number;
    matchDetails?: {
        skillScore: number;
        experienceScore: number;
        locationScore: number;
        semanticScore: number;
        recencyScore: number;
        overallScore: number;
        strengths: string[];
        missingSkills: string[];
        recommendation: string;
        confidenceScore: number;
    };
    githubData?: {
        username: string;
        publicRepos: number;
        followers: number;
        contributions: number;
        topLanguages: string[];
        topRepos: Array<{
            name: string;
            description?: string;
            stars: number;
            language?: string;
            url: string;
        }>;
        techStackScore: number;
    };
    status: 'sourced' | 'shortlisted' | 'contacted' | 'responded' | 'in_pipeline' | 'rejected' | 'saved';
    contactedAt?: Date;
    respondedAt?: Date;
    notes?: Array<{
        addedBy: mongoose.Types.ObjectId;
        note: string;
        createdAt: Date;
    }>;
    deletedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const SourcedCandidate: mongoose.Model<ISourcedCandidateDocument, {}, {}, {}, mongoose.Document<unknown, {}, ISourcedCandidateDocument, {}, {}> & ISourcedCandidateDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=SourcedCandidate.d.ts.map