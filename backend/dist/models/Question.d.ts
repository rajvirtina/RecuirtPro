import mongoose, { Document } from 'mongoose';
import { QuestionDifficulty } from '../types';
export interface IQuestionDocument extends Document {
    companyId?: mongoose.Types.ObjectId;
    question: string;
    questionType: 'technical' | 'behavioral' | 'situational' | 'coding' | 'system_design';
    difficulty: QuestionDifficulty;
    skills: string[];
    expectedAnswer?: string;
    hints?: string[];
    estimatedDuration: number;
    isActive: boolean;
    createdBy: mongoose.Types.ObjectId;
    usageCount: number;
    averageRating?: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Question: mongoose.Model<IQuestionDocument, {}, {}, {}, mongoose.Document<unknown, {}, IQuestionDocument, {}, {}> & IQuestionDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Question.d.ts.map