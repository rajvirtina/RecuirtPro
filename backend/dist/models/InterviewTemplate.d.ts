import mongoose, { Document } from 'mongoose';
import { InterviewTemplate as InterviewTemplateType } from '../types';
export interface IInterviewTemplateDocument extends Document {
    companyId?: mongoose.Types.ObjectId;
    name: string;
    type: InterviewTemplateType;
    description?: string;
    rounds: Array<{
        roundName: string;
        duration: number;
        questionCount: number;
        difficultyDistribution: {
            junior?: number;
            senior?: number;
            expert?: number;
        };
        skills?: string[];
    }>;
    totalDuration: number;
    passingCriteria?: {
        minimumRating: number;
        minimumRounds: number;
    };
    isDefault: boolean;
    isActive: boolean;
    createdBy: mongoose.Types.ObjectId;
    usageCount: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const InterviewTemplate: mongoose.Model<IInterviewTemplateDocument, {}, {}, {}, mongoose.Document<unknown, {}, IInterviewTemplateDocument, {}, {}> & IInterviewTemplateDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=InterviewTemplate.d.ts.map