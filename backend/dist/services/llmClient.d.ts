/**
 * LLM Service Client — calls the Python LLM microservice for AI features.
 * Endpoints: /api/schedule, /api/feedback, /api/candidate-message
 */
declare class LLMServiceClient {
    private client;
    private available;
    constructor();
    private checkHealth;
    isAvailable(): boolean;
    /**
     * Schedule Interview — find optimal slot between HR and candidate availability
     */
    scheduleInterview(data: {
        hr_availability: string[];
        candidate_availability: string[];
        interview_type: string;
        duration_minutes?: number;
    }): Promise<{
        success: boolean;
        selected_slot?: string;
        email_subject?: string;
        email_body?: string;
        error?: string;
    }>;
    /**
     * Analyze Interview Feedback — parse raw notes into structured evaluation
     */
    analyzeFeedback(data: {
        role: string;
        interview_type: string;
        raw_feedback: string;
    }): Promise<{
        success: boolean;
        structured_feedback?: any;
        overall_score?: number;
        recommendation?: string;
        error?: string;
    }>;
    /**
     * Generate Candidate Communication — produce external-safe message based on evaluation
     */
    generateCandidateMessage(data: {
        evaluation_summary: string;
        outcome: 'offer' | 'hold' | 'reject';
        candidate_name?: string;
    }): Promise<{
        success: boolean;
        message?: string;
        subject?: string;
        error?: string;
    }>;
    /**
     * AI-powered semantic matching for sourcing — uses embeddings when LLM is available
     */
    semanticMatch(data: {
        candidate_skills: string[];
        job_requirements: string[];
        candidate_summary?: string;
        job_description?: string;
    }): Promise<{
        score: number;
        analysis?: string;
    }>;
}
export declare const llmClient: LLMServiceClient;
export {};
//# sourceMappingURL=llmClient.d.ts.map