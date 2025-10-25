/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */

import { Response } from 'express';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import { candidateSourcingService, SourcingCriteria } from '../services/candidateSourcingService';
import { Job } from '../models';
import logger from '../utils/logger';

/**
 * @desc    Search candidates from multiple sources
 * @route   POST /api/v1/sourcing/search
 * @access  Private (Employer/HR/Admin)
 */
export const searchCandidates = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { sources, criteria } = req.body;

    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return sendError(res, 'At least one source must be specified', 400);
    }

    const validSources = ['linkedin', 'naukri'];
    const invalidSources = sources.filter((s: string) => !validSources.includes(s));
    if (invalidSources.length > 0) {
      return sendError(
        res,
        `Invalid sources: ${invalidSources.join(', ')}. Valid sources are: ${validSources.join(', ')}`,
        400
      );
    }

    const sourcingCriteria: SourcingCriteria = {
      keywords: criteria?.keywords || [],
      skills: criteria?.skills || [],
      location: criteria?.location,
      experienceMin: criteria?.experienceMin,
      experienceMax: criteria?.experienceMax,
      maxResults: criteria?.maxResults || 25,
    };

    logger.info(`Sourcing candidates from: ${sources.join(', ')}`);

    const candidates = await candidateSourcingService.searchCandidates(
      sources,
      sourcingCriteria
    );

    return sendSuccess(
      res,
      {
        candidates,
        count: candidates.length,
        sources,
        criteria: sourcingCriteria,
      },
      'Candidates sourced successfully'
    );
  } catch (error: any) {
    logger.error('Error in searchCandidates:', error);
    return sendError(res, error.message || 'Error sourcing candidates', 500);
  }
};

/**
 * @desc    Search candidates for a specific job
 * @route   POST /api/v1/sourcing/jobs/:jobId/candidates
 * @access  Private (Employer/HR/Admin)
 */
export const searchCandidatesForJob = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { jobId } = req.params;
    const { sources } = req.body;

    const job = await Job.findById(jobId);
    if (!job) {
      return sendError(res, 'Job not found', 404);
    }

    // Authorization check
    const isAuthorized =
      req.user?.role === 'admin' ||
      ((req.user?.role === 'employer' || req.user?.role === 'hr') &&
        job.companyId?.toString() === req.user?.companyId);

    if (!isAuthorized) {
      return sendError(res, 'Not authorized to source candidates for this job', 403);
    }

    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return sendError(res, 'At least one source must be specified', 400);
    }

    // Build criteria from job requirements
    const criteria: SourcingCriteria = {
      keywords: [job.title],
      skills: job.skills,
      location: job.location,
      experienceMin: job.experienceMin,
      experienceMax: job.experienceMax,
      maxResults: req.body.maxResults || 25,
    };

    logger.info(`Sourcing candidates for job ${jobId} from: ${sources.join(', ')}`);

    const candidates = await candidateSourcingService.searchCandidates(sources, criteria);

    // Calculate match scores
    const candidatesWithScores = candidates.map((candidate) => ({
      ...candidate,
      matchScore: candidateSourcingService.calculateMatchScore(candidate, {
        skills: job.skills,
        experienceMin: job.experienceMin,
        experienceMax: job.experienceMax,
        location: job.location,
      }),
    }));

    // Sort by match score
    candidatesWithScores.sort((a, b) => b.matchScore - a.matchScore);

    return sendSuccess(
      res,
      {
        job: {
          id: job._id,
          title: job.title,
          skills: job.skills,
          location: job.location,
          experience: `${job.experienceMin}-${job.experienceMax} years`,
        },
        candidates: candidatesWithScores,
        count: candidatesWithScores.length,
        sources,
      },
      'Candidates sourced successfully for job'
    );
  } catch (error: any) {
    logger.error('Error in searchCandidatesForJob:', error);
    return sendError(res, error.message || 'Error sourcing candidates for job', 500);
  }
};

/**
 * @desc    Get sourcing statistics
 * @route   GET /api/v1/sourcing/stats
 * @access  Private (Employer/HR/Admin)
 */
export const getSourcingStats = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    // In a real implementation, this would track actual sourcing activities
    // For now, return mock statistics

    const stats = {
      totalCandidatesSourced: 150,
      sourceBreakdown: {
        linkedin: 75,
        naukri: 60,
        manual: 15,
      },
      averageMatchScore: 85,
      candidatesContacted: 45,
      responseRate: 35,
      candidatesInterviewed: 12,
      candidatesHired: 3,
      topSkillsSourced: [
        { skill: 'React', count: 45 },
        { skill: 'Node.js', count: 38 },
        { skill: 'Python', count: 32 },
        { skill: 'AWS', count: 28 },
        { skill: 'MongoDB', count: 25 },
      ],
      sourcingByMonth: [
        { month: 'Jan', count: 20 },
        { month: 'Feb', count: 25 },
        { month: 'Mar', count: 30 },
        { month: 'Apr', count: 35 },
        { month: 'May', count: 40 },
      ],
    };

    return sendSuccess(res, stats, 'Sourcing statistics retrieved successfully');
  } catch (error: any) {
    logger.error('Error in getSourcingStats:', error);
    return sendError(res, error.message || 'Error getting sourcing statistics', 500);
  }
};
