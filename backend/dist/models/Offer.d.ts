import mongoose, { Document } from 'mongoose';
import { OfferStatus } from '../types';
export interface IOfferDocument extends Document {
    companyId: mongoose.Types.ObjectId;
    applicationId: mongoose.Types.ObjectId;
    jobId: mongoose.Types.ObjectId;
    candidateId: mongoose.Types.ObjectId;
    createdBy: mongoose.Types.ObjectId;
    status: OfferStatus;
    salary: {
        amount: number;
        currency: string;
        frequency: 'annual' | 'monthly';
    };
    bonus?: {
        amount: number;
        type: 'signing' | 'performance' | 'retention';
        details?: string;
    };
    equity?: {
        type: 'stock_options' | 'rsus' | 'esops';
        units?: number;
        vestingPeriod?: string;
        details?: string;
    };
    designation: string;
    department?: string;
    reportingTo?: string;
    joiningDate: Date;
    location?: string;
    workMode?: 'onsite' | 'remote' | 'hybrid';
    probationPeriod?: number;
    noticePeriod?: number;
    benefits?: string[];
    additionalTerms?: string;
    offerLetterUrl?: string;
    offerLetterHtml?: string;
    approvedBy?: mongoose.Types.ObjectId;
    approvedAt?: Date;
    approvalComments?: string;
    sentAt?: Date;
    expiresAt?: Date;
    respondedAt?: Date;
    candidateComments?: string;
    negotiations?: Array<{
        round: number;
        proposedBy: 'company' | 'candidate';
        changes: Record<string, any>;
        comments?: string;
        createdAt: Date;
    }>;
    statusHistory: Array<{
        status: OfferStatus;
        changedBy: mongoose.Types.ObjectId;
        changedAt: Date;
        remarks?: string;
    }>;
    deletedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Offer: mongoose.Model<IOfferDocument, {}, {}, {}, mongoose.Document<unknown, {}, IOfferDocument, {}, {}> & IOfferDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Offer.d.ts.map