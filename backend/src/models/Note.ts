import mongoose, { Schema, Document } from 'mongoose';

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

const NoteSchema = new Schema<INoteDocument>(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
    content: { type: String, required: true, maxlength: 2000 },
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

NoteSchema.index({ applicationId: 1, deletedAt: 1, createdAt: -1 });

export const Note = mongoose.model<INoteDocument>('Note', NoteSchema);
