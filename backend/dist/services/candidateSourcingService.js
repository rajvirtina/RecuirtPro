"use strict";
/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.candidateSourcingService = exports.CandidateSourcingService = exports.NaukriSourcingService = exports.LinkedInSourcingService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * LinkedIn Candidate Sourcing
 * Note: LinkedIn's official API requires partnership/enterprise access
 * This is a simplified implementation using LinkedIn search
 */
class LinkedInSourcingService {
    constructor() {
        // For production: Use official LinkedIn Recruiter API or partner services
        this.apiKey = process.env.LINKEDIN_API_KEY || '';
        this.apiUrl = process.env.LINKEDIN_API_URL || 'https://api.linkedin.com/v2';
    }
    /**
     * Search candidates on LinkedIn
     * Note: This requires LinkedIn Recruiter license or partner API access
     */
    async searchCandidates(criteria) {
        try {
            if (!this.apiKey) {
                logger_1.default.warn('LinkedIn API key not configured');
                return this.getMockLinkedInCandidates(criteria);
            }
            // Build search query
            const params = {
                keywords: criteria.keywords?.join(' '),
                location: criteria.location,
                count: criteria.maxResults || 25,
            };
            // For production implementation with LinkedIn API
            // const response = await axios.get(`${this.apiUrl}/people-search`, {
            //   headers: {
            //     'Authorization': `Bearer ${this.apiKey}`,
            //     'X-Restli-Protocol-Version': '2.0.0'
            //   },
            //   params
            // });
            // For now, return mock data for demonstration
            return this.getMockLinkedInCandidates(criteria);
        }
        catch (error) {
            logger_1.default.error('LinkedIn sourcing error:', error);
            throw new Error('Failed to source candidates from LinkedIn');
        }
    }
    /**
     * Mock LinkedIn candidates for demonstration
     */
    getMockLinkedInCandidates(criteria) {
        const mockCandidates = [
            {
                source: 'linkedin',
                externalId: 'linkedin_001',
                name: 'Rahul Sharma',
                email: 'rahul.sharma@email.com',
                phone: '+91-9876543210',
                location: criteria.location || 'Bangalore, India',
                currentCompany: 'Tech Corp India',
                currentPosition: 'Senior Software Engineer',
                experience: 5,
                skills: ['React', 'Node.js', 'MongoDB', 'AWS', 'TypeScript'],
                education: ['B.Tech Computer Science - IIT Delhi'],
                summary: '5+ years of experience in full-stack development with expertise in MERN stack',
                profileUrl: 'https://linkedin.com/in/rahul-sharma',
                imageUrl: 'https://via.placeholder.com/150',
                lastActive: new Date(),
                matchScore: 92,
            },
            {
                source: 'linkedin',
                externalId: 'linkedin_002',
                name: 'Priya Patel',
                email: 'priya.patel@email.com',
                phone: '+91-9876543211',
                location: criteria.location || 'Mumbai, India',
                currentCompany: 'Digital Solutions Ltd',
                currentPosition: 'Full Stack Developer',
                experience: 3,
                skills: ['Angular', 'Node.js', 'PostgreSQL', 'Docker', 'Kubernetes'],
                education: ['M.Tech Software Engineering - BITS Pilani'],
                summary: '3 years of experience building scalable web applications',
                profileUrl: 'https://linkedin.com/in/priya-patel',
                imageUrl: 'https://via.placeholder.com/150',
                lastActive: new Date(),
                matchScore: 88,
            },
            {
                source: 'linkedin',
                externalId: 'linkedin_003',
                name: 'Amit Kumar',
                email: 'amit.kumar@email.com',
                phone: '+91-9876543212',
                location: criteria.location || 'Pune, India',
                currentCompany: 'Cloud Systems Inc',
                currentPosition: 'DevOps Engineer',
                experience: 4,
                skills: ['AWS', 'Docker', 'Kubernetes', 'CI/CD', 'Python', 'Terraform'],
                education: ['B.E. Computer Engineering - Pune University'],
                summary: 'DevOps engineer specializing in cloud infrastructure and automation',
                profileUrl: 'https://linkedin.com/in/amit-kumar',
                imageUrl: 'https://via.placeholder.com/150',
                lastActive: new Date(),
                matchScore: 85,
            },
        ];
        // Filter based on criteria
        return mockCandidates.filter((candidate) => {
            if (criteria.skills && criteria.skills.length > 0) {
                const hasSkills = criteria.skills.some((skill) => candidate.skills.some((cs) => cs.toLowerCase().includes(skill.toLowerCase())));
                if (!hasSkills)
                    return false;
            }
            if (criteria.experienceMin && candidate.experience < criteria.experienceMin) {
                return false;
            }
            if (criteria.experienceMax && candidate.experience > criteria.experienceMax) {
                return false;
            }
            return true;
        });
    }
}
exports.LinkedInSourcingService = LinkedInSourcingService;
/**
 * Naukri Candidate Sourcing
 * Note: Requires Naukri RMS (Recruitment Management System) API access
 */
class NaukriSourcingService {
    constructor() {
        // Naukri API credentials (requires subscription)
        this.apiKey = process.env.NAUKRI_API_KEY || '';
        this.apiUrl = process.env.NAUKRI_API_URL || 'https://rms.naukri.com/api';
    }
    /**
     * Search candidates on Naukri
     */
    async searchCandidates(criteria) {
        try {
            if (!this.apiKey) {
                logger_1.default.warn('Naukri API key not configured');
                return this.getMockNaukriCandidates(criteria);
            }
            // Build search parameters for Naukri API
            const params = {
                keywords: criteria.keywords?.join(' '),
                location: criteria.location,
                minExp: criteria.experienceMin,
                maxExp: criteria.experienceMax,
                pageSize: criteria.maxResults || 25,
            };
            // For production implementation with Naukri RMS API
            // const response = await axios.post(`${this.apiUrl}/resume-search`, params, {
            //   headers: {
            //     'Authorization': `Bearer ${this.apiKey}`,
            //     'Content-Type': 'application/json'
            //   }
            // });
            // For now, return mock data
            return this.getMockNaukriCandidates(criteria);
        }
        catch (error) {
            logger_1.default.error('Naukri sourcing error:', error);
            throw new Error('Failed to source candidates from Naukri');
        }
    }
    /**
     * Mock Naukri candidates for demonstration
     */
    getMockNaukriCandidates(criteria) {
        const mockCandidates = [
            {
                source: 'naukri',
                externalId: 'naukri_001',
                name: 'Sneha Reddy',
                email: 'sneha.reddy@email.com',
                phone: '+91-9876543213',
                location: criteria.location || 'Hyderabad, India',
                currentCompany: 'InfoTech Solutions',
                currentPosition: 'Java Developer',
                experience: 6,
                skills: ['Java', 'Spring Boot', 'Microservices', 'MySQL', 'Redis'],
                education: ['B.Tech IT - JNTU Hyderabad'],
                summary: '6 years of backend development experience with Java and Spring',
                profileUrl: 'https://naukri.com/profile/sneha-reddy',
                resumeUrl: 'https://naukri.com/resume/sneha-reddy.pdf',
                lastActive: new Date(),
                matchScore: 90,
            },
            {
                source: 'naukri',
                externalId: 'naukri_002',
                name: 'Vikram Singh',
                email: 'vikram.singh@email.com',
                phone: '+91-9876543214',
                location: criteria.location || 'Delhi, India',
                currentCompany: 'E-commerce Giants',
                currentPosition: 'Frontend Developer',
                experience: 4,
                skills: ['React', 'Vue.js', 'JavaScript', 'HTML5', 'CSS3', 'Webpack'],
                education: ['MCA - Delhi University'],
                summary: 'Frontend specialist with 4 years building responsive web applications',
                profileUrl: 'https://naukri.com/profile/vikram-singh',
                resumeUrl: 'https://naukri.com/resume/vikram-singh.pdf',
                lastActive: new Date(),
                matchScore: 87,
            },
            {
                source: 'naukri',
                externalId: 'naukri_003',
                name: 'Anjali Verma',
                email: 'anjali.verma@email.com',
                phone: '+91-9876543215',
                location: criteria.location || 'Bangalore, India',
                currentCompany: 'Data Analytics Co',
                currentPosition: 'Data Engineer',
                experience: 5,
                skills: ['Python', 'Apache Spark', 'Hadoop', 'SQL', 'Airflow', 'Kafka'],
                education: ['M.Sc Data Science - ISI Bangalore'],
                summary: 'Data engineer with expertise in big data processing and ETL pipelines',
                profileUrl: 'https://naukri.com/profile/anjali-verma',
                resumeUrl: 'https://naukri.com/resume/anjali-verma.pdf',
                lastActive: new Date(),
                matchScore: 84,
            },
        ];
        // Filter based on criteria
        return mockCandidates.filter((candidate) => {
            if (criteria.skills && criteria.skills.length > 0) {
                const hasSkills = criteria.skills.some((skill) => candidate.skills.some((cs) => cs.toLowerCase().includes(skill.toLowerCase())));
                if (!hasSkills)
                    return false;
            }
            if (criteria.experienceMin && candidate.experience < criteria.experienceMin) {
                return false;
            }
            if (criteria.experienceMax && candidate.experience > criteria.experienceMax) {
                return false;
            }
            return true;
        });
    }
    /**
     * Parse resume from Naukri
     */
    async parseResume(resumeUrl) {
        try {
            // For production: Use Naukri's resume parsing API or third-party services
            // like RChilli, Sovren, Textkernel
            logger_1.default.info(`Parsing resume from: ${resumeUrl}`);
            return {
                name: 'Parsed Candidate',
                skills: ['Skill1', 'Skill2'],
                experience: 3,
            };
        }
        catch (error) {
            logger_1.default.error('Resume parsing error:', error);
            throw new Error('Failed to parse resume');
        }
    }
}
exports.NaukriSourcingService = NaukriSourcingService;
/**
 * Unified Candidate Sourcing Service
 */
class CandidateSourcingService {
    constructor() {
        this.linkedInService = new LinkedInSourcingService();
        this.naukriService = new NaukriSourcingService();
    }
    /**
     * Search candidates from multiple sources
     */
    async searchCandidates(sources, criteria) {
        const results = [];
        try {
            const promises = sources.map(async (source) => {
                if (source === 'linkedin') {
                    return this.linkedInService.searchCandidates(criteria);
                }
                else if (source === 'naukri') {
                    return this.naukriService.searchCandidates(criteria);
                }
                return [];
            });
            const allResults = await Promise.all(promises);
            allResults.forEach((sourceResults) => {
                results.push(...sourceResults);
            });
            // Sort by match score
            return results.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
        }
        catch (error) {
            logger_1.default.error('Candidate sourcing error:', error);
            throw error;
        }
    }
    /**
     * Calculate match score for a candidate against job requirements
     */
    calculateMatchScore(candidate, jobRequirements) {
        let score = 0;
        // Skills match (60% weight)
        const candidateSkills = candidate.skills.map((s) => s.toLowerCase());
        const requiredSkills = jobRequirements.skills.map((s) => s.toLowerCase());
        const matchedSkills = requiredSkills.filter((skill) => candidateSkills.some((cs) => cs.includes(skill) || skill.includes(cs)));
        const skillScore = (matchedSkills.length / requiredSkills.length) * 60;
        score += skillScore;
        // Experience match (25% weight)
        if (candidate.experience) {
            if (candidate.experience >= jobRequirements.experienceMin &&
                candidate.experience <= jobRequirements.experienceMax) {
                score += 25;
            }
            else {
                const diff = Math.min(Math.abs(candidate.experience - jobRequirements.experienceMin), Math.abs(candidate.experience - jobRequirements.experienceMax));
                score += Math.max(0, 25 - diff * 3);
            }
        }
        // Location match (15% weight)
        if (jobRequirements.location && candidate.location) {
            if (candidate.location.toLowerCase().includes(jobRequirements.location.toLowerCase()) ||
                jobRequirements.location.toLowerCase().includes(candidate.location.toLowerCase())) {
                score += 15;
            }
        }
        return Math.round(Math.min(100, score));
    }
}
exports.CandidateSourcingService = CandidateSourcingService;
exports.candidateSourcingService = new CandidateSourcingService();
//# sourceMappingURL=candidateSourcingService.js.map