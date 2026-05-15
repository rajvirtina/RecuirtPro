"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmClient = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../config"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * LLM Service Client — calls the Python LLM microservice for AI features.
 * Endpoints: /api/schedule, /api/feedback, /api/candidate-message
 */
class LLMServiceClient {
    constructor() {
        this.available = false;
        this.client = axios_1.default.create({
            baseURL: config_1.default.llm.serviceUrl,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': config_1.default.llm.apiSecretKey,
            },
        });
        // Check availability on startup
        this.checkHealth();
    }
    async checkHealth() {
        try {
            const res = await this.client.get('/health');
            this.available = res.data?.status === 'healthy';
            if (this.available) {
                logger_1.default.info(`LLM Service connected at ${config_1.default.llm.serviceUrl}`);
            }
        }
        catch {
            this.available = false;
            logger_1.default.warn(`LLM Service unavailable at ${config_1.default.llm.serviceUrl} — AI features will use fallbacks`);
        }
    }
    isAvailable() {
        return this.available;
    }
    /**
     * Schedule Interview — find optimal slot between HR and candidate availability
     */
    async scheduleInterview(data) {
        if (!this.available) {
            // Fallback: pick first overlapping slot
            const overlap = data.hr_availability.find(s => data.candidate_availability.includes(s));
            return {
                success: !!overlap,
                selected_slot: overlap || data.hr_availability[0],
                email_subject: `${data.interview_type} Interview Scheduled`,
                email_body: `Your ${data.interview_type} interview has been scheduled.`,
            };
        }
        try {
            const res = await this.client.post('/api/schedule', data);
            return res.data;
        }
        catch (error) {
            logger_1.default.error('LLM schedule error:', error.message);
            return { success: false, error: 'LLM service unavailable' };
        }
    }
    /**
     * Analyze Interview Feedback — parse raw notes into structured evaluation
     */
    async analyzeFeedback(data) {
        if (!this.available) {
            return {
                success: true,
                structured_feedback: { notes: data.raw_feedback },
                overall_score: 0,
                recommendation: 'Manual review required — LLM service not available',
            };
        }
        try {
            const res = await this.client.post('/api/feedback', data);
            return res.data;
        }
        catch (error) {
            logger_1.default.error('LLM feedback error:', error.message);
            return { success: false, error: 'LLM service unavailable' };
        }
    }
    /**
     * Generate Candidate Communication — produce external-safe message based on evaluation
     */
    async generateCandidateMessage(data) {
        if (!this.available) {
            const templates = {
                offer: `Dear ${data.candidate_name || 'Candidate'}, we are pleased to inform you that you have been selected. Our HR team will reach out with the next steps.`,
                hold: `Dear ${data.candidate_name || 'Candidate'}, thank you for your time. We are currently reviewing all candidates and will update you shortly.`,
                reject: `Dear ${data.candidate_name || 'Candidate'}, thank you for your interest. After careful consideration, we have decided to move forward with other candidates.`,
            };
            return {
                success: true,
                subject: `Application Update — ${data.outcome === 'offer' ? 'Congratulations!' : 'Application Status'}`,
                message: templates[data.outcome] || templates.hold,
            };
        }
        try {
            const res = await this.client.post('/api/candidate-message', data);
            return res.data;
        }
        catch (error) {
            logger_1.default.error('LLM message error:', error.message);
            return { success: false, error: 'LLM service unavailable' };
        }
    }
    /**
     * AI-powered semantic matching for sourcing — uses embeddings when LLM is available
     */
    async semanticMatch(data) {
        if (!this.available) {
            // Keyword-based fallback
            const overlap = data.candidate_skills.filter(s => data.job_requirements.some(r => r.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(r.toLowerCase())));
            return { score: Math.round((overlap.length / Math.max(data.job_requirements.length, 1)) * 100) };
        }
        try {
            const res = await this.client.post('/api/semantic-match', data);
            return res.data;
        }
        catch {
            const overlap = data.candidate_skills.filter(s => data.job_requirements.some(r => r.toLowerCase().includes(s.toLowerCase())));
            return { score: Math.round((overlap.length / Math.max(data.job_requirements.length, 1)) * 100) };
        }
    }
}
exports.llmClient = new LLMServiceClient();
//# sourceMappingURL=llmClient.js.map