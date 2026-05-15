"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rankCandidates = exports.calculateCandidateScore = exports.calculateExperienceMatch = exports.calculateSkillMatch = void 0;
/**
 * Calculate skill match score
 */
const calculateSkillMatch = (requiredSkills, candidateSkills) => {
    if (!requiredSkills.length)
        return 100;
    const normalizedRequired = requiredSkills.map(s => s.toLowerCase().trim());
    const normalizedCandidate = candidateSkills.map(s => s.toLowerCase().trim());
    const matchCount = normalizedRequired.filter(skill => normalizedCandidate.includes(skill)).length;
    return Math.round((matchCount / normalizedRequired.length) * 100);
};
exports.calculateSkillMatch = calculateSkillMatch;
/**
 * Calculate experience match
 */
const calculateExperienceMatch = (requiredMin, requiredMax, candidateExp) => {
    if (candidateExp >= requiredMin && candidateExp <= requiredMax) {
        return 100;
    }
    if (candidateExp < requiredMin) {
        const diff = requiredMin - candidateExp;
        return Math.max(0, 100 - (diff * 10));
    }
    const diff = candidateExp - requiredMax;
    return Math.max(0, 100 - (diff * 5));
};
exports.calculateExperienceMatch = calculateExperienceMatch;
/**
 * Calculate overall candidate score
 */
const calculateCandidateScore = (skillMatch, experienceMatch, weights = { skill: 0.6, experience: 0.4 }) => {
    return Math.round((skillMatch * weights.skill) + (experienceMatch * weights.experience));
};
exports.calculateCandidateScore = calculateCandidateScore;
const rankCandidates = (candidates, jobRequirements) => {
    return candidates
        .map(candidate => {
        const skillMatch = (0, exports.calculateSkillMatch)(jobRequirements.skills, candidate.skills);
        const experienceMatch = (0, exports.calculateExperienceMatch)(jobRequirements.experienceMin, jobRequirements.experienceMax, candidate.experience);
        const score = (0, exports.calculateCandidateScore)(skillMatch, experienceMatch);
        return {
            candidateId: candidate.id,
            score,
            skillMatch,
            experienceMatch,
        };
    })
        .sort((a, b) => b.score - a.score);
};
exports.rankCandidates = rankCandidates;
//# sourceMappingURL=ranking.js.map