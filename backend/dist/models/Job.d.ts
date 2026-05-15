import mongoose, { Document } from 'mongoose';
import { JobStatus, JobType, WorkMode, IJobPosting } from '../types';
export interface IJobDocument extends Document {
    companyId: mongoose.Types.ObjectId;
    title: string;
    description: string;
    responsibilities?: string[];
    requirements?: string[];
    skills: string[];
    experienceMin: number;
    experienceMax: number;
    salaryMin?: number;
    salaryMax?: number;
    currency: string;
    location: string;
    workMode: WorkMode;
    jobType: JobType;
    status: JobStatus;
    department?: string;
    positions: number;
    joiningDate?: Date;
    expiryDate?: Date;
    tags?: string[];
    version: number;
    previousVersionId?: mongoose.Types.ObjectId;
    postings: IJobPosting[];
    createdBy: mongoose.Types.ObjectId;
    publishedAt?: Date;
    closedAt?: Date;
    viewCount: number;
    applicationCount: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}
export declare const Job: mongoose.Model<IJobDocument, {}, {}, {}, mongoose.Document<unknown, {}, IJobDocument, {}, {}> & IJobDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Job.d.ts.map