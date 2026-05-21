import mongoose, { Schema, Document } from 'mongoose';

// ─── Sub-document types ───────────────────────────────────────────────────────

export interface IAIQuestion {
  id: string;
  text: string;
  type: 'technical' | 'behavioral' | 'situational' | 'hr';
  expectedDurationSeconds: number;
  orderIndex: number;
}

export interface IAIResponseScores {
  technicalAccuracy: number;   // 1-10
  communicationClarity: number;
  confidence: number;
  overall: number;
}

export interface IAIResponse {
  questionId: string;
  questionText: string;
  responseText: string;
  responseTimeSeconds: number;
  scores: IAIResponseScores;
  feedback: string;
  improvementTip: string;
  passed: boolean;
  answeredAt: Date;
}

export interface IAIAnalysis {
  overallScore: number;        // 0-100 normalised
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
  questionsAnswered: number;
  questionsPassed: number;
  recommendation: 'strong_hire' | 'hire' | 'hold' | 'reject';
  strengths: string[];
  improvements: string[];
  summary: string;
  generatedAt: Date;
}

// ─── Main document interface ──────────────────────────────────────────────────

export interface IAIInterviewSessionDocument extends Document {
  sessionId: string;                           // public URL token (hex-64)
  interviewId: mongoose.Types.ObjectId;        // ref: Interview
  candidateId: mongoose.Types.ObjectId;        // ref: User
  jobId: mongoose.Types.ObjectId;              // ref: Job
  companyId: mongoose.Types.ObjectId;          // ref: Company

  // Denormalised for fast public-route access (no populated joins needed)
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  requiredSkills: string[];
  interviewRound: string;
  difficulty: 'junior' | 'senior' | 'expert';
  totalQuestions: number;

  status: 'pending' | 'in_progress' | 'completed' | 'expired';

  questions: IAIQuestion[];
  responses: IAIResponse[];
  analysis?: IAIAnalysis;

  currentQuestionIndex: number;    // tracks next expected question
  consentGiven: boolean;
  consentGivenAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  expiresAt: Date;                 // TTL for automatic expiry

  proctoringEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const AIQuestionSchema = new Schema<IAIQuestion>(
  {
    id:                      { type: String, required: true },
    text:                    { type: String, required: true },
    type:                    { type: String, enum: ['technical', 'behavioral', 'situational', 'hr'], required: true },
    expectedDurationSeconds: { type: Number, default: 150 },
    orderIndex:              { type: Number, required: true },
  },
  { _id: false }
);

const AIResponseScoresSchema = new Schema<IAIResponseScores>(
  {
    technicalAccuracy:   { type: Number, min: 1, max: 10, default: 5 },
    communicationClarity:{ type: Number, min: 1, max: 10, default: 5 },
    confidence:          { type: Number, min: 1, max: 10, default: 5 },
    overall:             { type: Number, min: 1, max: 10, default: 5 },
  },
  { _id: false }
);

const AIResponseSchema = new Schema<IAIResponse>(
  {
    questionId:          { type: String, required: true },
    questionText:        { type: String, required: true },
    responseText:        { type: String, required: true },
    responseTimeSeconds: { type: Number, default: 0 },
    scores:              { type: AIResponseScoresSchema, required: true },
    feedback:            { type: String, default: '' },
    improvementTip:      { type: String, default: '' },
    passed:              { type: Boolean, default: true },
    answeredAt:          { type: Date, default: Date.now },
  },
  { _id: false }
);

const AIAnalysisSchema = new Schema<IAIAnalysis>(
  {
    overallScore:       { type: Number, min: 0, max: 100 },
    technicalScore:     { type: Number, min: 0, max: 100 },
    communicationScore: { type: Number, min: 0, max: 100 },
    confidenceScore:    { type: Number, min: 0, max: 100 },
    questionsAnswered:  { type: Number, default: 0 },
    questionsPassed:    { type: Number, default: 0 },
    recommendation:     { type: String, enum: ['strong_hire', 'hire', 'hold', 'reject'] },
    strengths:          [String],
    improvements:       [String],
    summary:            { type: String, default: '' },
    generatedAt:        { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─── Main schema ──────────────────────────────────────────────────────────────

const aiInterviewSessionSchema = new Schema<IAIInterviewSessionDocument>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    interviewId: {
      type: Schema.Types.ObjectId,
      ref: 'Interview',
      required: true,
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    jobTitle:        { type: String, required: true },
    companyName:     { type: String, required: true },
    jobDescription:  { type: String, default: '' },
    requiredSkills:  [String],
    interviewRound:  { type: String, default: 'L1' },
    difficulty:      { type: String, enum: ['junior', 'senior', 'expert'], default: 'senior' },
    totalQuestions:  { type: Number, default: 7 },

    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'expired'],
      default: 'pending',
    },

    questions:            { type: [AIQuestionSchema], default: [] },
    responses:            { type: [AIResponseSchema], default: [] },
    analysis:             { type: AIAnalysisSchema },
    currentQuestionIndex: { type: Number, default: 0 },

    consentGiven:   { type: Boolean, default: false },
    consentGivenAt: { type: Date },
    startedAt:      { type: Date },
    completedAt:    { type: Date },
    expiresAt:      { type: Date, required: true },  // TTL handled by application logic

    proctoringEnabled: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

aiInterviewSessionSchema.index({ interviewId: 1 });
aiInterviewSessionSchema.index({ candidateId: 1 });
aiInterviewSessionSchema.index({ companyId: 1, status: 1 });
// TTL index: MongoDB auto-removes expired sessions 1 hour after expiresAt
aiInterviewSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

// ─── Export ───────────────────────────────────────────────────────────────────

export const AIInterviewSession = mongoose.model<IAIInterviewSessionDocument>(
  'AIInterviewSession',
  aiInterviewSessionSchema
);
