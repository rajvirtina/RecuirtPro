"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sourcingService = exports.SourcingService = exports.AIMatchingEngine = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("../utils/logger"));
const types_1 = require("../types");
// ============================================================
// LINKEDIN SERVICE (OAuth2 + API)
// ============================================================
class LinkedInService {
    constructor() {
        this.clientId = process.env.LINKEDIN_CLIENT_ID || '';
        this.clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
        this.redirectUri = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:5001/api/v1/sourcing/oauth/linkedin/callback';
    }
    getAuthUrl(state) {
        const scopes = ['r_liteprofile', 'r_emailaddress', 'w_member_social'];
        return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&state=${state}&scope=${scopes.join('%20')}`;
    }
    async exchangeCode(code) {
        const response = await axios_1.default.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
            params: {
                grant_type: 'authorization_code',
                code,
                redirect_uri: this.redirectUri,
                client_id: this.clientId,
                client_secret: this.clientSecret,
            },
        });
        return {
            accessToken: response.data.access_token,
            expiresIn: response.data.expires_in,
            refreshToken: response.data.refresh_token,
        };
    }
    async searchCandidates(accessToken, criteria) {
        if (!this.clientId) {
            logger_1.default.info('LinkedIn API not configured — returning simulated results');
            return this.getSimulatedResults(criteria);
        }
        try {
            // Production: Use LinkedIn Recruiter System Connect API or Talent Solutions API
            // The People Search API requires LinkedIn Recruiter subscription
            const client = axios_1.default.create({
                baseURL: 'https://api.linkedin.com/v2',
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            // Attempt real LinkedIn search
            const response = await client.get('/people', {
                params: {
                    q: 'keyword',
                    keywords: criteria.keywords?.join(' '),
                    count: criteria.maxResults || 25,
                },
            });
            return this.mapLinkedInResults(response.data, criteria);
        }
        catch (error) {
            if (error.response?.status === 401) {
                throw new Error('LinkedIn token expired — please reconnect');
            }
            logger_1.default.warn('LinkedIn API error, falling back to simulated results:', error.message);
            return this.getSimulatedResults(criteria);
        }
    }
    async mapLinkedInResults(data, criteria) {
        if (!data?.elements)
            return [];
        return Promise.all(data.elements.map(async (el, i) => {
            const skills = el.skills?.map((s) => s.name) || [];
            const matchDetails = await AIMatchingEngine.calculateMatch(skills, el.experience || 0, el.location || '', criteria, []);
            return {
                platform: types_1.SourcingPlatform.LINKEDIN,
                externalId: el.id || `linkedin_${i}`,
                name: `${el.firstName || ''} ${el.lastName || ''}`.trim(),
                email: el.emailAddress,
                location: el.location?.name,
                currentCompany: el.positions?.values?.[0]?.company?.name,
                currentPosition: el.positions?.values?.[0]?.title,
                experience: el.numConnections ? Math.floor(el.numConnections / 100) : 0,
                skills,
                summary: el.headline,
                profileUrl: el.publicProfileUrl,
                matchScore: matchDetails.overallScore,
                matchDetails,
            };
        }));
    }
    async getSimulatedResults(criteria) {
        const pool = [
            { name: 'Rahul Sharma', company: 'Tech Corp India', position: 'Senior Software Engineer', exp: 5, skills: ['React', 'Node.js', 'MongoDB', 'AWS', 'TypeScript'], location: 'Bangalore, India', edu: ['B.Tech CS - IIT Delhi'] },
            { name: 'Priya Patel', company: 'Digital Solutions', position: 'Full Stack Developer', exp: 3, skills: ['Angular', 'Node.js', 'PostgreSQL', 'Docker', 'Kubernetes'], location: 'Mumbai, India', edu: ['M.Tech SE - BITS Pilani'] },
            { name: 'Amit Kumar', company: 'Cloud Systems Inc', position: 'DevOps Engineer', exp: 4, skills: ['AWS', 'Docker', 'Kubernetes', 'CI/CD', 'Python', 'Terraform'], location: 'Pune, India', edu: ['B.E. CE - Pune University'] },
            { name: 'Deepa Nair', company: 'FinTech Labs', position: 'Backend Developer', exp: 6, skills: ['Java', 'Spring Boot', 'Kafka', 'Redis', 'MySQL', 'AWS'], location: 'Chennai, India', edu: ['B.Tech IT - Anna University'] },
            { name: 'Karan Singh', company: 'AI Ventures', position: 'ML Engineer', exp: 4, skills: ['Python', 'TensorFlow', 'PyTorch', 'AWS SageMaker', 'Docker'], location: 'Hyderabad, India', edu: ['M.Sc AI - IIIT Hyderabad'] },
        ];
        const results = await Promise.all(pool.map(async (p, i) => {
            const matchDetails = await AIMatchingEngine.calculateMatch(p.skills, p.exp, p.location, criteria, []);
            return {
                platform: types_1.SourcingPlatform.LINKEDIN,
                externalId: `linkedin_${i + 1}`,
                name: p.name,
                location: p.location,
                currentCompany: p.company,
                currentPosition: p.position,
                experience: p.exp,
                skills: p.skills,
                education: p.edu,
                summary: `${p.exp}+ years as ${p.position} at ${p.company}`,
                profileUrl: `https://linkedin.com/in/${p.name.toLowerCase().replace(/\s+/g, '-')}`,
                lastActive: new Date(),
                matchScore: matchDetails.overallScore,
                matchDetails,
            };
        }));
        return results.filter(c => c.matchScore >= (criteria.minMatchScore || 0));
    }
}
// ============================================================
// NAUKRI SERVICE
// ============================================================
class NaukriService {
    constructor() {
        this.apiKey = process.env.NAUKRI_API_KEY || '';
    }
    async searchCandidates(apiKey, criteria) {
        const key = apiKey || this.apiKey;
        if (!key) {
            logger_1.default.info('Naukri API not configured — returning simulated results');
            return this.getSimulatedResults(criteria);
        }
        try {
            const response = await axios_1.default.post('https://rms.naukri.com/api/resume-search', {
                keywords: criteria.keywords?.join(' '),
                skills: criteria.skills?.join(','),
                location: criteria.location,
                minExp: criteria.experienceMin,
                maxExp: criteria.experienceMax,
                pageSize: criteria.maxResults || 25,
            }, {
                headers: { Authorization: `Bearer ${key}` },
            });
            return this.mapNaukriResults(response.data, criteria);
        }
        catch (error) {
            logger_1.default.warn('Naukri API error, falling back to simulated results:', error.message);
            return this.getSimulatedResults(criteria);
        }
    }
    async mapNaukriResults(data, criteria) {
        if (!data?.candidates)
            return [];
        return Promise.all(data.candidates.map(async (c, i) => {
            const skills = c.skills || [];
            const matchDetails = await AIMatchingEngine.calculateMatch(skills, c.experience || 0, c.location || '', criteria, []);
            return {
                platform: types_1.SourcingPlatform.NAUKRI,
                externalId: c.id || `naukri_${i}`,
                name: c.name,
                email: c.email,
                phone: c.phone,
                location: c.location,
                currentCompany: c.currentCompany,
                currentPosition: c.designation,
                experience: c.experience,
                skills,
                education: c.education ? [c.education] : [],
                summary: c.summary,
                profileUrl: c.profileUrl,
                resumeUrl: c.resumeUrl,
                matchScore: matchDetails.overallScore,
                matchDetails,
            };
        }));
    }
    async getSimulatedResults(criteria) {
        const pool = [
            { name: 'Sneha Reddy', company: 'InfoTech Solutions', position: 'Java Developer', exp: 6, skills: ['Java', 'Spring Boot', 'Microservices', 'MySQL', 'Redis'], location: 'Hyderabad, India', edu: ['B.Tech IT - JNTU'] },
            { name: 'Vikram Singh', company: 'E-commerce Giants', position: 'Frontend Developer', exp: 4, skills: ['React', 'Vue.js', 'JavaScript', 'HTML5', 'CSS3', 'Webpack'], location: 'Delhi, India', edu: ['MCA - Delhi University'] },
            { name: 'Anjali Verma', company: 'Data Analytics Co', position: 'Data Engineer', exp: 5, skills: ['Python', 'Apache Spark', 'Hadoop', 'SQL', 'Airflow', 'Kafka'], location: 'Bangalore, India', edu: ['M.Sc Data Science - ISI'] },
            { name: 'Suresh Menon', company: 'WebStack India', position: 'Full Stack Developer', exp: 3, skills: ['React', 'Node.js', 'Express', 'MongoDB', 'TypeScript', 'GraphQL'], location: 'Kochi, India', edu: ['B.Tech CS - NIT Calicut'] },
            { name: 'Meera Krishnan', company: 'SecureNet', position: 'Security Engineer', exp: 7, skills: ['Python', 'AWS', 'Penetration Testing', 'OWASP', 'Docker'], location: 'Bangalore, India', edu: ['M.Tech InfoSec - IIIT'] },
        ];
        const results = await Promise.all(pool.map(async (p, i) => {
            const matchDetails = await AIMatchingEngine.calculateMatch(p.skills, p.exp, p.location, criteria, []);
            return {
                platform: types_1.SourcingPlatform.NAUKRI,
                externalId: `naukri_${i + 1}`,
                name: p.name,
                location: p.location,
                currentCompany: p.company,
                currentPosition: p.position,
                experience: p.exp,
                skills: p.skills,
                education: p.edu,
                summary: `${p.exp}+ years as ${p.position} at ${p.company}`,
                profileUrl: `https://naukri.com/profile/${p.name.toLowerCase().replace(/\s+/g, '-')}`,
                resumeUrl: `https://naukri.com/resume/${p.name.toLowerCase().replace(/\s+/g, '-')}.pdf`,
                lastActive: new Date(),
                matchScore: matchDetails.overallScore,
                matchDetails,
            };
        }));
        return results.filter(c => c.matchScore >= (criteria.minMatchScore || 0));
    }
}
// ============================================================
// GITHUB SERVICE (OAuth2 + Public API)
// ============================================================
class GitHubService {
    constructor() {
        this.clientId = process.env.GITHUB_CLIENT_ID || '';
        this.clientSecret = process.env.GITHUB_CLIENT_SECRET || '';
        this.redirectUri = process.env.GITHUB_REDIRECT_URI || 'http://localhost:5001/api/v1/sourcing/oauth/github/callback';
    }
    getAuthUrl(state) {
        return `https://github.com/login/oauth/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&state=${state}&scope=read:user,read:org`;
    }
    async exchangeCode(code) {
        const response = await axios_1.default.post('https://github.com/login/oauth/access_token', {
            client_id: this.clientId,
            client_secret: this.clientSecret,
            code,
        }, {
            headers: { Accept: 'application/json' },
        });
        return { accessToken: response.data.access_token };
    }
    async searchDevelopers(accessToken, criteria) {
        const token = accessToken || process.env.GITHUB_TOKEN;
        if (!token && !this.clientId) {
            logger_1.default.info('GitHub API not configured — returning simulated results');
            return this.getSimulatedResults(criteria);
        }
        try {
            const headers = { Accept: 'application/vnd.github+json' };
            if (token)
                headers.Authorization = `Bearer ${token}`;
            // Build GitHub user search query
            const queryParts = [];
            if (criteria.skills?.length)
                queryParts.push(criteria.skills.join('+'));
            if (criteria.location)
                queryParts.push(`location:${criteria.location.split(',')[0].trim()}`);
            queryParts.push('type:user');
            const searchQuery = queryParts.join('+');
            const response = await axios_1.default.get(`https://api.github.com/search/users`, {
                params: { q: searchQuery, per_page: Math.min(criteria.maxResults || 10, 30) },
                headers,
            });
            if (!response.data?.items?.length)
                return [];
            // Fetch detailed profiles and repos for each user
            const candidates = await Promise.all(response.data.items.slice(0, 10).map((user) => this.enrichGitHubUser(user, token, criteria)));
            return candidates.filter((c) => c !== null);
        }
        catch (error) {
            if (error.response?.status === 403) {
                logger_1.default.warn('GitHub API rate limited');
            }
            logger_1.default.warn('GitHub API error, falling back to simulated results:', error.message);
            return this.getSimulatedResults(criteria);
        }
    }
    async enrichGitHubUser(user, token, criteria) {
        try {
            const headers = { Accept: 'application/vnd.github+json' };
            if (token)
                headers.Authorization = `Bearer ${token}`;
            // Fetch user profile
            const profileRes = await axios_1.default.get(`https://api.github.com/users/${user.login}`, { headers });
            const profile = profileRes.data;
            // Fetch repos to extract tech stack
            const reposRes = await axios_1.default.get(`https://api.github.com/users/${user.login}/repos`, {
                params: { sort: 'updated', per_page: 30 },
                headers,
            });
            const repos = reposRes.data || [];
            // Extract languages
            const langCounts = {};
            repos.forEach((repo) => {
                if (repo.language) {
                    langCounts[repo.language] = (langCounts[repo.language] || 0) + 1;
                }
            });
            const topLanguages = Object.entries(langCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6)
                .map(([lang]) => lang);
            const topRepos = repos
                .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
                .slice(0, 5)
                .map((repo) => ({
                name: repo.name,
                description: repo.description,
                stars: repo.stargazers_count || 0,
                language: repo.language,
                url: repo.html_url,
            }));
            const techStackScore = this.calculateTechStackScore(topLanguages, criteria.skills || []);
            const skills = topLanguages;
            const matchDetails = await AIMatchingEngine.calculateMatch(skills, 0, profile.location || '', criteria, topLanguages);
            const githubData = {
                username: user.login,
                publicRepos: profile.public_repos || 0,
                followers: profile.followers || 0,
                contributions: 0, // Would need GraphQL for contributions
                topLanguages,
                topRepos,
                techStackScore,
            };
            return {
                platform: types_1.SourcingPlatform.GITHUB,
                externalId: `github_${user.id}`,
                name: profile.name || user.login,
                email: profile.email,
                location: profile.location,
                currentCompany: profile.company,
                currentPosition: profile.bio ? profile.bio.substring(0, 100) : undefined,
                skills: topLanguages,
                summary: profile.bio,
                profileUrl: profile.html_url,
                lastActive: profile.updated_at ? new Date(profile.updated_at) : undefined,
                matchScore: matchDetails.overallScore,
                matchDetails,
                githubData,
            };
        }
        catch (error) {
            logger_1.default.warn(`Failed to enrich GitHub user ${user.login}`);
            return null;
        }
    }
    calculateTechStackScore(userLangs, requiredSkills) {
        if (!requiredSkills.length)
            return 50;
        const matchedCount = requiredSkills.filter(skill => userLangs.some(lang => lang.toLowerCase() === skill.toLowerCase())).length;
        return Math.round((matchedCount / requiredSkills.length) * 100);
    }
    async getSimulatedResults(criteria) {
        const pool = [
            { name: 'Arjun Dev', login: 'arjundev', repos: 45, followers: 320, langs: ['TypeScript', 'React', 'Node.js', 'Python'], location: 'Bangalore', bio: 'Full-stack developer | Open source contributor', company: 'TechStartup' },
            { name: 'Nisha Gupta', login: 'nishag', repos: 32, followers: 180, langs: ['Python', 'Go', 'Docker', 'Kubernetes'], location: 'Mumbai', bio: 'Cloud & DevOps engineer | GDE', company: 'CloudFirst' },
            { name: 'Raj Mehta', login: 'rajmehta', repos: 28, followers: 150, langs: ['Java', 'Spring Boot', 'Kafka', 'React'], location: 'Pune', bio: 'Backend engineer specializing in distributed systems', company: 'ScaleUp Labs' },
        ];
        const results = await Promise.all(pool.map(async (p, i) => {
            const matchDetails = await AIMatchingEngine.calculateMatch(p.langs, 0, p.location, criteria, p.langs);
            const techStackScore = this.calculateTechStackScore(p.langs, criteria.skills || []);
            return {
                platform: types_1.SourcingPlatform.GITHUB,
                externalId: `github_${i + 1}`,
                name: p.name,
                location: p.location + ', India',
                currentCompany: p.company,
                currentPosition: p.bio,
                skills: p.langs,
                summary: p.bio,
                profileUrl: `https://github.com/${p.login}`,
                lastActive: new Date(),
                matchScore: matchDetails.overallScore,
                matchDetails,
                githubData: {
                    username: p.login,
                    publicRepos: p.repos,
                    followers: p.followers,
                    contributions: Math.floor(Math.random() * 500) + 100,
                    topLanguages: p.langs,
                    topRepos: p.langs.slice(0, 3).map((lang, j) => ({
                        name: `${lang.toLowerCase()}-project`,
                        description: `A ${lang} project`,
                        stars: Math.floor(Math.random() * 50) + 5,
                        language: lang,
                        url: `https://github.com/${p.login}/${lang.toLowerCase()}-project`,
                    })),
                    techStackScore,
                },
            };
        }));
        return results.filter(c => c.matchScore >= (criteria.minMatchScore || 0));
    }
}
// ============================================================
// AI MATCHING ENGINE — Semantic + Weighted Scoring
// ============================================================
class AIMatchingEngine {
    /**
     * Multi-dimensional match scoring with semantic similarity.
     * Weights: Skills(40%) + Experience(20%) + Location(10%) + Semantic(20%) + Recency(10%)
     */
    static async calculateMatch(candidateSkills, candidateExperience, candidateLocation, criteria, techStack) {
        const skillScore = this.calcSkillScore(candidateSkills, criteria.skills || [], criteria.techStack || []);
        const experienceScore = this.calcExperienceScore(candidateExperience, criteria.experienceMin, criteria.experienceMax);
        const locationScore = this.calcLocationScore(candidateLocation, criteria.location);
        const semanticScore = await this.calcSemanticScore(candidateSkills, criteria.keywords || [], techStack);
        const recencyScore = 80; // Default — real implementation uses lastActive date
        // Weighted composite
        const overallScore = Math.round(skillScore * 0.40 +
            experienceScore * 0.20 +
            locationScore * 0.10 +
            semanticScore * 0.20 +
            recencyScore * 0.10);
        const allRequired = [...(criteria.skills || []), ...(criteria.techStack || [])];
        const matchedSkills = allRequired.filter(s => candidateSkills.some(cs => cs.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(cs.toLowerCase())));
        const missingSkills = allRequired.filter(s => !candidateSkills.some(cs => cs.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(cs.toLowerCase())));
        const strengths = [];
        if (skillScore >= 80)
            strengths.push(`Strong skill match (${matchedSkills.length}/${allRequired.length || 1} matched)`);
        if (experienceScore >= 80)
            strengths.push('Experience well-aligned');
        if (locationScore >= 80)
            strengths.push('Location match');
        if (semanticScore >= 80)
            strengths.push('High semantic relevance');
        if (techStack.length > 5)
            strengths.push('Diverse tech stack');
        const recommendation = overallScore >= 90
            ? 'Highly recommended — strong match across all dimensions'
            : overallScore >= 85
                ? 'Recommended — solid match with minor skill gaps'
                : overallScore >= 75
                    ? 'Worth reviewing — moderate match'
                    : 'Below threshold — significant gaps';
        const confidenceScore = Math.min(100, Math.round((allRequired.length > 0 ? 40 : 20) +
            (criteria.experienceMin !== undefined ? 20 : 0) +
            (criteria.location ? 15 : 0) +
            (criteria.keywords?.length ? 15 : 0) +
            10));
        return {
            skillScore,
            experienceScore,
            locationScore,
            semanticScore,
            recencyScore,
            overallScore,
            strengths,
            missingSkills,
            recommendation,
            confidenceScore,
        };
    }
    /**
     * Skill matching with fuzzy/synonym support
     */
    static calcSkillScore(candidateSkills, requiredSkills, techStack) {
        const allRequired = [...requiredSkills, ...techStack];
        if (allRequired.length === 0)
            return 70; // no requirements = neutral
        // Synonym mapping for common tech skills
        const synonyms = {
            'javascript': ['js', 'ecmascript', 'es6', 'es2015'],
            'typescript': ['ts'],
            'react': ['reactjs', 'react.js'],
            'node.js': ['nodejs', 'node'],
            'vue.js': ['vuejs', 'vue'],
            'angular': ['angularjs'],
            'mongodb': ['mongo'],
            'postgresql': ['postgres', 'pg'],
            'mysql': ['mariadb'],
            'amazon web services': ['aws'],
            'google cloud': ['gcp'],
            'microsoft azure': ['azure'],
            'kubernetes': ['k8s'],
            'ci/cd': ['cicd', 'continuous integration', 'jenkins', 'github actions'],
            'machine learning': ['ml'],
            'artificial intelligence': ['ai'],
            'python': ['py'],
        };
        let matchedCount = 0;
        for (const required of allRequired) {
            const reqLower = required.toLowerCase();
            const isMatch = candidateSkills.some(cs => {
                const csLower = cs.toLowerCase();
                if (csLower === reqLower || csLower.includes(reqLower) || reqLower.includes(csLower))
                    return true;
                // Check synonyms
                for (const [key, syns] of Object.entries(synonyms)) {
                    const allForms = [key, ...syns];
                    if (allForms.includes(reqLower) && allForms.some(f => csLower.includes(f) || f.includes(csLower)))
                        return true;
                }
                return false;
            });
            if (isMatch)
                matchedCount++;
        }
        return Math.round((matchedCount / allRequired.length) * 100);
    }
    static calcExperienceScore(candidateExp, minExp, maxExp) {
        if (minExp === undefined && maxExp === undefined)
            return 75;
        if (candidateExp === 0)
            return 50; // unknown experience
        const min = minExp || 0;
        const max = maxExp || min + 5;
        const ideal = (min + max) / 2;
        if (candidateExp >= min && candidateExp <= max)
            return 100;
        if (candidateExp < min) {
            const deficit = min - candidateExp;
            return Math.max(30, 100 - deficit * 20);
        }
        // Slightly over-experienced is okay
        const excess = candidateExp - max;
        return Math.max(50, 100 - excess * 10);
    }
    static calcLocationScore(candidateLocation, requiredLocation) {
        if (!requiredLocation)
            return 75;
        if (!candidateLocation)
            return 50;
        const cl = candidateLocation.toLowerCase();
        const rl = requiredLocation.toLowerCase();
        if (cl.includes(rl) || rl.includes(cl))
            return 100;
        // City-level match
        const candidateCity = cl.split(',')[0].trim();
        const requiredCity = rl.split(',')[0].trim();
        if (candidateCity === requiredCity)
            return 100;
        // Same country
        const candidateCountry = cl.split(',').pop()?.trim();
        const requiredCountry = rl.split(',').pop()?.trim();
        if (candidateCountry && requiredCountry && candidateCountry === requiredCountry)
            return 60;
        return 30;
    }
    /**
     * Semantic score using LLM embeddings when available, keyword overlap as fallback.
     */
    static async calcSemanticScore(candidateSkills, keywords, techStack) {
        if (keywords.length === 0 && techStack.length === 0)
            return 70;
        // Try LLM-based semantic matching first
        try {
            const { llmClient } = await import('./llmClient.js');
            if (llmClient.isAvailable()) {
                const result = await llmClient.semanticMatch({
                    candidate_skills: candidateSkills,
                    job_requirements: [...keywords, ...techStack],
                });
                return result.score;
            }
        }
        catch { /* fallback to keyword matching */ }
        // Keyword overlap fallback
        const allTerms = [...keywords, ...techStack];
        const candidateText = candidateSkills.join(' ').toLowerCase();
        let hits = 0;
        for (const term of allTerms) {
            const tl = term.toLowerCase();
            if (candidateText.includes(tl))
                hits++;
            else if (tl.split(' ').some(w => w.length > 3 && candidateText.includes(w)))
                hits += 0.5;
        }
        return Math.min(100, Math.round((hits / Math.max(allTerms.length, 1)) * 100));
    }
}
exports.AIMatchingEngine = AIMatchingEngine;
// ============================================================
// UNIFIED SOURCING SERVICE — Orchestrates all platforms
// ============================================================
class SourcingService {
    constructor() {
        this.linkedInService = new LinkedInService();
        this.naukriService = new NaukriService();
        this.gitHubService = new GitHubService();
    }
    getOAuthUrl(platform, state) {
        switch (platform) {
            case types_1.SourcingPlatform.LINKEDIN:
                return this.linkedInService.getAuthUrl(state);
            case types_1.SourcingPlatform.GITHUB:
                return this.gitHubService.getAuthUrl(state);
            default:
                throw new Error(`OAuth not supported for ${platform}`);
        }
    }
    async exchangeOAuthCode(platform, code) {
        switch (platform) {
            case types_1.SourcingPlatform.LINKEDIN:
                return this.linkedInService.exchangeCode(code);
            case types_1.SourcingPlatform.GITHUB:
                return this.gitHubService.exchangeCode(code);
            default:
                throw new Error(`OAuth not supported for ${platform}`);
        }
    }
    async searchCandidates(platforms, criteria, tokens) {
        const startTime = Date.now();
        const allCandidates = [];
        const promises = platforms.map(async (platform) => {
            try {
                switch (platform) {
                    case types_1.SourcingPlatform.LINKEDIN:
                        return await this.linkedInService.searchCandidates(tokens.linkedin || '', criteria);
                    case types_1.SourcingPlatform.NAUKRI:
                        return await this.naukriService.searchCandidates(tokens.naukri || null, criteria);
                    case types_1.SourcingPlatform.GITHUB:
                        return await this.gitHubService.searchDevelopers(tokens.github || null, criteria);
                    default:
                        return [];
                }
            }
            catch (error) {
                logger_1.default.error(`Error sourcing from ${platform}:`, error.message);
                return [];
            }
        });
        const results = await Promise.all(promises);
        results.forEach(r => allCandidates.push(...r));
        // Deduplicate by email or name+company
        const seen = new Set();
        const deduped = allCandidates.filter(c => {
            const key = c.email || `${c.name}|${c.currentCompany}`;
            if (seen.has(key.toLowerCase()))
                return false;
            seen.add(key.toLowerCase());
            return true;
        });
        // Sort by match score descending
        deduped.sort((a, b) => b.matchScore - a.matchScore);
        return {
            candidates: deduped,
            executionTimeMs: Date.now() - startTime,
        };
    }
    async calculateMatchForJob(candidate, job) {
        return AIMatchingEngine.calculateMatch(candidate.skills, candidate.experience || 0, candidate.location || '', {
            skills: job.skills,
            techStack: job.techStack,
            experienceMin: job.experienceMin,
            experienceMax: job.experienceMax,
            location: job.location,
            keywords: [job.title, ...(job.preferredSkills || [])],
        }, candidate.githubData?.topLanguages || []);
    }
}
exports.SourcingService = SourcingService;
exports.sourcingService = new SourcingService();
//# sourceMappingURL=sourcingService.js.map