/**
 * Calculate skill match score
 */
export const calculateSkillMatch = (
  requiredSkills: string[],
  candidateSkills: string[]
): number => {
  if (!requiredSkills.length) return 100;
  
  const normalizedRequired = requiredSkills.map(s => s.toLowerCase().trim());
  const normalizedCandidate = candidateSkills.map(s => s.toLowerCase().trim());
  
  const matchCount = normalizedRequired.filter(skill => 
    normalizedCandidate.includes(skill)
  ).length;
  
  return Math.round((matchCount / normalizedRequired.length) * 100);
};

/**
 * Calculate experience match
 */
export const calculateExperienceMatch = (
  requiredMin: number,
  requiredMax: number,
  candidateExp: number
): number => {
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

/**
 * Calculate overall candidate score
 */
export const calculateCandidateScore = (
  skillMatch: number,
  experienceMatch: number,
  weights = { skill: 0.6, experience: 0.4 }
): number => {
  return Math.round(
    (skillMatch * weights.skill) + (experienceMatch * weights.experience)
  );
};

/**
 * Rank candidates
 */
export interface CandidateRanking {
  candidateId: string;
  score: number;
  skillMatch: number;
  experienceMatch: number;
}

export const rankCandidates = (
  candidates: Array<{
    id: string;
    skills: string[];
    experience: number;
  }>,
  jobRequirements: {
    skills: string[];
    experienceMin: number;
    experienceMax: number;
  }
): CandidateRanking[] => {
  return candidates
    .map(candidate => {
      const skillMatch = calculateSkillMatch(
        jobRequirements.skills,
        candidate.skills
      );
      const experienceMatch = calculateExperienceMatch(
        jobRequirements.experienceMin,
        jobRequirements.experienceMax,
        candidate.experience
      );
      const score = calculateCandidateScore(skillMatch, experienceMatch);
      
      return {
        candidateId: candidate.id,
        score,
        skillMatch,
        experienceMatch,
      };
    })
    .sort((a, b) => b.score - a.score);
};
