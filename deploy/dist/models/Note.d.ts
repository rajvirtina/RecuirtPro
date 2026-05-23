import mongoose, { Document } from 'mongoose';
export interface INoteDocument extends Document {
    applicationId: mongoose.Types.ObjectId;
    authorId: mongoose.Types.ObjectId;
    authorName: string;
    content: string;
    mentions: mongoose.Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}
export declare const Note: mongoose.Model<INoteDocument, {}, {}, {}, mongoose.Document<unknown, {}, INoteDocument, {}, {}> & INoteDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Note.d.ts.map