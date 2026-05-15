import mongoose, { Document } from 'mongoose';
import { SourcingPlatform } from '../types';
export interface ISourcingSearchDocument extends Document {
    companyId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    jobId?: mongoose.Types.ObjectId;
    platforms: SourcingPlatform[];
    criteria: {
        keywords?: string[];
        skills?: string[];
        location?: string;
        experienceMin?: number;
        experienceMax?: number;
        noticePeriod?: string;
        employmentType?: string;
        education?: string[];
        techStack?: string[];
        minMatchScore?: number;
    };
    resultsCount: number;
    shortlistedCount: number;
    avgMatchScore?: number;
    executionTimeMs?: number;
    deletedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const SourcingSearch: mongoose.Model<ISourcingSearchDocument, {}, {}, {}, mongoose.Document<unknown, {}, ISourcingSearchDocument, {}, {}> & ISourcingSearchDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=SourcingSearch.d.ts.map