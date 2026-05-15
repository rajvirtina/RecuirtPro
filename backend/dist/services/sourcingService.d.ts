import { SourcingPlatform } from '../types';
export interface SourcingCriteria {
    keywords?: string[];
    skills?: string[];
    location?: string;
    experienceMin?: number;
    experienceMax?: number;
    noticePeriod?: string;
    employmentType?: string;
    education?: string[];
    techStack?: string[];
    maxResults?: number;
    minMatchScore?: number;
}
export interface CandidateProfile {
    platform: SourcingPlatform;
    externalId: string;
    name: string;
    email?: string;
    phone?: string;
    location?: string;
    currentCompany?: string;
    currentPosition?: string;
    experience?: number;
    skills: string[];
    education?: string[];
    summary?: string;
    profileUrl?: string;
    resumeUrl?: string;
    imageUrl?: string;
    lastActive?: Date;
    matchScore: number;
    matchDetails: MatchDetails;
    githubData?: GitHubProfile;
}
export interface MatchDetails {
    skillScore: number;
    experienceScore: number;
    locationScore: number;
    semanticScore: number;
    recencyScore: number;
    overallScore: number;
    strengths: string[];
    missingSkills: string[];
    recommendation: string;
    confidenceScore: number;
}
export interface GitHubProfile {
    username: string;
    publicRepos: number;
    followers: number;
    contributions: number;
    topLanguages: string[];
    topRepos: Array<{
        name: string;
        description?: string;
        stars: number;
        language?: string;
        url: string;
    }>;
    techStackScore: number;
}
export interface JobRequirements {
    title: string;
    description?: string;
    skills: string[];
    preferredSkills?: string[];
    experienceMin: number;
    experienceMax: number;
    location?: string;
    techStack?: string[];
    education?: string[];
}
export declare class AIMatchingEngine {
    /**
     * Multi-dimensional match scoring with semantic similarity.
     * Weights: Skills(40%) + Experience(20%) + Location(10%) + Semantic(20%) + Recency(10%)
     */
    static calculateMatch(candidateSkills: string[], candidateExperience: number, candidateLocation: string, criteria: SourcingCriteria, techStack: string[]): Promise<MatchDetails>;
    /**
     * Skill matching with fuzzy/synonym support
     */
    private static calcSkillScore;
    private static calcExperienceScore;
    private static calcLocationScore;
    /**
     * Semantic score using LLM embeddings when available, keyword overlap as fallback.
     */
    private static calcSemanticScore;
}
export declare class SourcingService {
    private linkedInService;
    private naukriService;
    private gitHubService;
    getOAuthUrl(platform: SourcingPlatform, state: string): string;
    exchangeOAuthCode(platform: SourcingPlatform, code: string): Promise<{
        accessToken: string;
        expiresIn?: number;
        refreshToken?: string;
    }>;
    searchCandidates(platforms: SourcingPlatform[], criteria: SourcingCriteria, tokens: Partial<Record<SourcingPlatform, string>>): Promise<{
        candidates: CandidateProfile[];
        executionTimeMs: number;
    }>;
    calculateMatchForJob(candidate: CandidateProfile, job: JobRequirements): Promise<MatchDetails>;
}
export declare const sourcingService: SourcingService;
//# sourceMappingURL=sourcingService.d.ts.map