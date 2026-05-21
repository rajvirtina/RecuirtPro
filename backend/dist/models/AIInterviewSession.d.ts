import mongoose, { Document } from 'mongoose';
export interface IAIQuestion {
    id: string;
    text: string;
    type: 'technical' | 'behavioral' | 'situational' | 'hr';
    expectedDurationSeconds: number;
    orderIndex: number;
}
export interface IAIResponseScores {
    technicalAccuracy: number;
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
    overallScore: number;
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
export interface IAIInterviewSessionDocument extends Document {
    sessionId: string;
    interviewId: mongoose.Types.ObjectId;
    candidateId: mongoose.Types.ObjectId;
    jobId: mongoose.Types.ObjectId;
    companyId: mongoose.Types.ObjectId;
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
    currentQuestionIndex: number;
    consentGiven: boolean;
    consentGivenAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    expiresAt: Date;
    proctoringEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const AIInterviewSession: mongoose.Model<IAIInterviewSessionDocument, {}, {}, {}, mongoose.Document<unknown, {}, IAIInterviewSessionDocument, {}, {}> & IAIInterviewSessionDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=AIInterviewSession.d.ts.map