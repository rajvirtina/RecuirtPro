import mongoose, { Document } from 'mongoose';
export interface IJobTemplateDocument extends Document {
    companyId: mongoose.Types.ObjectId;
    name: string;
    title: string;
    description: string;
    responsibilities: string[];
    requirements: string[];
    skills: string[];
    experienceMin: number;
    experienceMax: number;
    salaryMin?: number;
    salaryMax?: number;
    currency: string;
    location?: string;
    workMode: 'onsite' | 'remote' | 'hybrid';
    jobType: 'full_time' | 'part_time' | 'contract' | 'internship' | 'temporary';
    department?: string;
    isGlobal: boolean;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
export declare const JobTemplate: mongoose.Model<IJobTemplateDocument, {}, {}, {}, mongoose.Document<unknown, {}, IJobTemplateDocument, {}, {}> & IJobTemplateDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=JobTemplate.d.ts.map