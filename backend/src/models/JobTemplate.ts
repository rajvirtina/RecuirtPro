import mongoose, { Schema, Document } from 'mongoose';

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

const JobTemplateSchema = new Schema<IJobTemplateDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '' },
    responsibilities: [{ type: String }],
    requirements: [{ type: String }],
    skills: [{ type: String }],
    experienceMin: { type: Number, default: 0, min: 0 },
    experienceMax: { type: Number, default: 5, min: 0 },
    salaryMin: { type: Number, min: 0 },
    salaryMax: { type: Number, min: 0 },
    currency: { type: String, default: 'INR' },
    location: { type: String, trim: true },
    workMode: { type: String, enum: ['onsite', 'remote', 'hybrid'], default: 'onsite' },
    jobType: { type: String, enum: ['full_time', 'part_time', 'contract', 'internship', 'temporary'], default: 'full_time' },
    department: { type: String, trim: true },
    isGlobal: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

JobTemplateSchema.index({ companyId: 1, name: 1 });

export const JobTemplate = mongoose.model<IJobTemplateDocument>('JobTemplate', JobTemplateSchema);
