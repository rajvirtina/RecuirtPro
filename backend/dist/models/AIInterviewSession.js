"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIInterviewSession = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// ─── Sub-schemas ──────────────────────────────────────────────────────────────
const AIQuestionSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    text: { type: String, required: true },
    type: { type: String, enum: ['technical', 'behavioral', 'situational', 'hr'], required: true },
    expectedDurationSeconds: { type: Number, default: 150 },
    orderIndex: { type: Number, required: true },
}, { _id: false });
const AIResponseScoresSchema = new mongoose_1.Schema({
    technicalAccuracy: { type: Number, min: 1, max: 10, default: 5 },
    communicationClarity: { type: Number, min: 1, max: 10, default: 5 },
    confidence: { type: Number, min: 1, max: 10, default: 5 },
    overall: { type: Number, min: 1, max: 10, default: 5 },
}, { _id: false });
const AIResponseSchema = new mongoose_1.Schema({
    questionId: { type: String, required: true },
    questionText: { type: String, required: true },
    responseText: { type: String, required: true },
    responseTimeSeconds: { type: Number, default: 0 },
    scores: { type: AIResponseScoresSchema, required: true },
    feedback: { type: String, default: '' },
    improvementTip: { type: String, default: '' },
    passed: { type: Boolean, default: true },
    answeredAt: { type: Date, default: Date.now },
}, { _id: false });
const AIAnalysisSchema = new mongoose_1.Schema({
    overallScore: { type: Number, min: 0, max: 100 },
    technicalScore: { type: Number, min: 0, max: 100 },
    communicationScore: { type: Number, min: 0, max: 100 },
    confidenceScore: { type: Number, min: 0, max: 100 },
    questionsAnswered: { type: Number, default: 0 },
    questionsPassed: { type: Number, default: 0 },
    recommendation: { type: String, enum: ['strong_hire', 'hire', 'hold', 'reject'] },
    strengths: [String],
    improvements: [String],
    summary: { type: String, default: '' },
    generatedAt: { type: Date, default: Date.now },
}, { _id: false });
// ─── Main schema ──────────────────────────────────────────────────────────────
const aiInterviewSessionSchema = new mongoose_1.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    interviewId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Interview',
        required: true,
    },
    candidateId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    jobId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Job',
        required: true,
    },
    companyId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
    },
    jobTitle: { type: String, required: true },
    companyName: { type: String, required: true },
    jobDescription: { type: String, default: '' },
    requiredSkills: [String],
    interviewRound: { type: String, default: 'L1' },
    difficulty: { type: String, enum: ['junior', 'senior', 'expert'], default: 'senior' },
    totalQuestions: { type: Number, default: 7 },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'expired'],
        default: 'pending',
    },
    questions: { type: [AIQuestionSchema], default: [] },
    responses: { type: [AIResponseSchema], default: [] },
    analysis: { type: AIAnalysisSchema },
    currentQuestionIndex: { type: Number, default: 0 },
    consentGiven: { type: Boolean, default: false },
    consentGivenAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    expiresAt: { type: Date, required: true }, // TTL handled by application logic
    proctoringEnabled: { type: Boolean, default: true },
}, {
    timestamps: true,
});
// ─── Indexes ──────────────────────────────────────────────────────────────────
aiInterviewSessionSchema.index({ interviewId: 1 });
aiInterviewSessionSchema.index({ candidateId: 1 });
aiInterviewSessionSchema.index({ companyId: 1, status: 1 });
// TTL index: MongoDB auto-removes expired sessions 1 hour after expiresAt
aiInterviewSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });
// ─── Export ───────────────────────────────────────────────────────────────────
exports.AIInterviewSession = mongoose_1.default.model('AIInterviewSession', aiInterviewSessionSchema);
//# sourceMappingURL=AIInterviewSession.js.map