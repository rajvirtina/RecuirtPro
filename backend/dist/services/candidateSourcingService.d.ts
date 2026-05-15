/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */
export interface CandidateProfile {
    source: 'linkedin' | 'naukri' | 'manual';
    externalId?: string;
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
    matchScore?: number;
}
export interface SourcingCriteria {
    keywords?: string[];
    skills?: string[];
    location?: string;
    experienceMin?: number;
    experienceMax?: number;
    currentCompany?: string[];
    excludeCompanies?: string[];
    education?: string[];
    maxResults?: number;
}
/**
 * LinkedIn Candidate Sourcing
 * Note: LinkedIn's official API requires partnership/enterprise access
 * This is a simplified implementation using LinkedIn search
 */
export declare class LinkedInSourcingService {
    private apiKey;
    private apiUrl;
    constructor();
    /**
     * Search candidates on LinkedIn
     * Note: This requires LinkedIn Recruiter license or partner API access
     */
    searchCandidates(criteria: SourcingCriteria): Promise<CandidateProfile[]>;
    /**
     * Mock LinkedIn candidates for demonstration
     */
    private getMockLinkedInCandidates;
}
/**
 * Naukri Candidate Sourcing
 * Note: Requires Naukri RMS (Recruitment Management System) API access
 */
export declare class NaukriSourcingService {
    private apiKey;
    private apiUrl;
    constructor();
    /**
     * Search candidates on Naukri
     */
    searchCandidates(criteria: SourcingCriteria): Promise<CandidateProfile[]>;
    /**
     * Mock Naukri candidates for demonstration
     */
    private getMockNaukriCandidates;
    /**
     * Parse resume from Naukri
     */
    parseResume(resumeUrl: string): Promise<Partial<CandidateProfile>>;
}
/**
 * Unified Candidate Sourcing Service
 */
export declare class CandidateSourcingService {
    private linkedInService;
    private naukriService;
    constructor();
    /**
     * Search candidates from multiple sources
     */
    searchCandidates(sources: ('linkedin' | 'naukri')[], criteria: SourcingCriteria): Promise<CandidateProfile[]>;
    /**
     * Calculate match score for a candidate against job requirements
     */
    calculateMatchScore(candidate: CandidateProfile, jobRequirements: {
        skills: string[];
        experienceMin: number;
        experienceMax: number;
        location?: string;
    }): number;
}
export declare const candidateSourcingService: CandidateSourcingService;
//# sourceMappingURL=candidateSourcingService.d.ts.map