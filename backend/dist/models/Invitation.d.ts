import mongoose, { Document } from 'mongoose';
export interface IInvitationDocument extends Document {
    email: string;
    companyId: mongoose.Types.ObjectId;
    invitedBy: mongoose.Types.ObjectId;
    token: string;
    role: 'candidate';
    status: 'pending' | 'accepted' | 'expired';
    expiresAt: Date;
    acceptedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Invitation: mongoose.Model<IInvitationDocument, {}, {}, {}, mongoose.Document<unknown, {}, IInvitationDocument, {}, {}> & IInvitationDocument & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Invitation.d.ts.map