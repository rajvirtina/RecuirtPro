/**
 * Calculate skill match score
 */
export declare const calculateSkillMatch: (requiredSkills: string[], candidateSkills: string[]) => number;
/**
 * Calculate experience match
 */
export declare const calculateExperienceMatch: (requiredMin: number, requiredMax: number, candidateExp: number) => number;
/**
 * Calculate overall candidate score
 */
export declare const calculateCandidateScore: (skillMatch: number, experienceMatch: number, weights?: {
    skill: number;
    experience: number;
}) => number;
/**
 * Rank candidates
 */
export interface CandidateRanking {
    candidateId: string;
    score: number;
    skillMatch: number;
    experienceMatch: number;
}
export declare const rankCandidates: (candidates: Array<{
    id: string;
    skills: string[];
    experience: number;
}>, jobRequirements: {
    skills: string[];
    experienceMin: number;
    experienceMax: number;
}) => CandidateRanking[];
//# sourceMappingURL=ranking.d.ts.map