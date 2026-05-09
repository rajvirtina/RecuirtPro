import { Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { AuthRequest, SourcingPlatform, IntegrationStatus } from '../types';
import { sendSuccess, sendError, sendPaginatedResponse, clampPagination } from '../utils/response';
import { Job, SourcingIntegration, SourcedCandidate, SourcingSearch } from '../models';
import { sourcingService, SourcingCriteria } from '../services/sourcingService';
import { getTenantCompanyId } from '../middleware/auth';
import logger from '../utils/logger';

// In-memory state store for OAuth (use Redis in production)
const oauthStates = new Map<string, { userId: string; companyId: string; platform: string; expiresAt: number }>();

// ============================================================
// INTEGRATION MANAGEMENT
// ============================================================

export const getIntegrations = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const companyId = getTenantCompanyId(req.user) || req.user?.companyId;
    if (!companyId) return sendError(res, 'Company context required', 400);

    const integrations = await SourcingIntegration.find({ companyId, deletedAt: null })
      .select('-accessToken -refreshToken');

    const platformStatus = Object.values(SourcingPlatform).map(platform => {
      const integration = integrations.find(i => i.platform === platform);
      return {
        platform,
        status: integration?.status || IntegrationStatus.DISCONNECTED,
        connectedBy: integration?.userId,
        externalUsername: integration?.externalUsername,
        tokenExpiresAt: integration?.tokenExpiresAt,
        lastSyncAt: integration?.lastSyncAt,
        isExpired: integration?.tokenExpiresAt ? new Date() > integration.tokenExpiresAt : false,
      };
    });

    return sendSuccess(res, { integrations: platformStatus }, 'Integrations retrieved');
  } catch (error: any) {
    logger.error('Error in getIntegrations:', error);
    return sendError(res, error.message || 'Failed to get integrations', 500);
  }
};

export const initiateOAuth = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const { platform } = req.params;
    if (!Object.values(SourcingPlatform).includes(platform as SourcingPlatform)) {
      return sendError(res, `Invalid platform: ${platform}`, 400);
    }

    const companyId = getTenantCompanyId(req.user) || req.user?.companyId;
    if (!companyId) return sendError(res, 'Company context required', 400);

    if (platform === SourcingPlatform.NAUKRI) {
      const { apiKey } = req.body;
      // In dev mode, allow connecting without a real API key (uses simulated data)
      const token = apiKey || 'dev-simulated';

      await SourcingIntegration.findOneAndUpdate(
        { userId: req.user!._id, platform: SourcingPlatform.NAUKRI },
        {
          companyId,
          userId: req.user!._id,
          platform: SourcingPlatform.NAUKRI,
          status: IntegrationStatus.CONNECTED,
          accessToken: token,
          externalUsername: 'Naukri RMS',
        },
        { upsert: true, new: true }
      );
      return sendSuccess(res, { platform: 'naukri', status: 'connected' }, apiKey ? 'Naukri connected with API key' : 'Naukri connected in demo mode (simulated results)');
    }

    // If OAuth credentials are not configured, connect in demo mode
    if (
      (platform === SourcingPlatform.LINKEDIN && !process.env.LINKEDIN_CLIENT_ID) ||
      (platform === SourcingPlatform.GITHUB && !process.env.GITHUB_CLIENT_ID)
    ) {
      await SourcingIntegration.findOneAndUpdate(
        { userId: req.user!._id, platform },
        {
          companyId,
          userId: req.user!._id,
          platform,
          status: IntegrationStatus.CONNECTED,
          accessToken: 'dev-simulated',
          externalUsername: `${platform} Demo`,
        },
        { upsert: true, new: true }
      );
      return sendSuccess(res, { platform, status: 'connected' }, `${platform} connected in demo mode (simulated results)`);
    }

    const state = crypto.randomBytes(32).toString('hex');
    oauthStates.set(state, {
      userId: req.user!._id as string,
      companyId,
      platform,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    const authUrl = sourcingService.getOAuthUrl(platform as SourcingPlatform, state);
    return sendSuccess(res, { authUrl, state }, 'OAuth URL generated');
  } catch (error: any) {
    logger.error('Error in initiateOAuth:', error);
    return sendError(res, error.message || 'Failed to initiate OAuth', 500);
  }
};

export const oauthCallback = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const { platform } = req.params;
    const { code, state, error: oauthError } = req.query;

    if (oauthError) return sendError(res, `OAuth error: ${oauthError}`, 400);
    if (!code || !state) return sendError(res, 'Missing code or state', 400);

    const stateData = oauthStates.get(state as string);
    if (!stateData || stateData.expiresAt < Date.now() || stateData.platform !== platform) {
      return sendError(res, 'Invalid or expired OAuth state', 400);
    }
    oauthStates.delete(state as string);

    const tokenData = await sourcingService.exchangeOAuthCode(platform as SourcingPlatform, code as string);
    const tokenExpiresAt = tokenData.expiresIn ? new Date(Date.now() + tokenData.expiresIn * 1000) : undefined;

    await SourcingIntegration.findOneAndUpdate(
      { userId: stateData.userId, platform },
      {
        companyId: stateData.companyId,
        userId: stateData.userId,
        platform,
        status: IntegrationStatus.CONNECTED,
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        tokenExpiresAt,
        lastSyncAt: new Date(),
      },
      { upsert: true, new: true }
    );

    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sourcing?connected=${platform}`;
    return res.redirect(redirectUrl);
  } catch (error: any) {
    logger.error('Error in oauthCallback:', error);
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sourcing?error=${encodeURIComponent(error.message)}`;
    return res.redirect(redirectUrl);
  }
};

export const disconnectIntegration = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const { platform } = req.params;
    const companyId = getTenantCompanyId(req.user) || req.user?.companyId;
    if (!companyId) return sendError(res, 'Company context required', 400);

    const integration = await SourcingIntegration.findOne({ companyId, platform, deletedAt: null });
    if (!integration) return sendError(res, 'Integration not found', 404);

    integration.deletedAt = new Date();
    integration.status = IntegrationStatus.DISCONNECTED;
    await integration.save();

    return sendSuccess(res, null, `${platform} disconnected`);
  } catch (error: any) {
    logger.error('Error in disconnectIntegration:', error);
    return sendError(res, error.message || 'Failed to disconnect', 500);
  }
};

// ============================================================
// CANDIDATE SEARCH
// ============================================================

export const searchCandidates = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const { platforms, criteria: rawCriteria } = req.body;
    const companyId = getTenantCompanyId(req.user) || req.user?.companyId;
    if (!companyId) return sendError(res, 'Company context required', 400);

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return sendError(res, 'At least one platform must be specified', 400);
    }

    const validPlatforms = Object.values(SourcingPlatform);
    const invalid = platforms.filter((p: string) => !validPlatforms.includes(p as SourcingPlatform));
    if (invalid.length) return sendError(res, `Invalid platforms: ${invalid.join(', ')}`, 400);

    const criteria: SourcingCriteria = {
      keywords: rawCriteria?.keywords || [],
      skills: rawCriteria?.skills || [],
      location: rawCriteria?.location,
      experienceMin: rawCriteria?.experienceMin,
      experienceMax: rawCriteria?.experienceMax,
      noticePeriod: rawCriteria?.noticePeriod,
      employmentType: rawCriteria?.employmentType,
      education: rawCriteria?.education,
      techStack: rawCriteria?.techStack,
      maxResults: Math.min(rawCriteria?.maxResults || 25, 100),
      minMatchScore: rawCriteria?.minMatchScore || 85,
    };

    // Get stored tokens
    const integrations = await SourcingIntegration.find({
      companyId,
      platform: { $in: platforms },
      status: IntegrationStatus.CONNECTED,
      deletedAt: null,
    }).select('+accessToken');

    const tokens: Partial<Record<SourcingPlatform, string>> = {};
    for (const int of integrations) {
      try { tokens[int.platform as SourcingPlatform] = int.getDecryptedAccessToken(); } catch { /* noop */ }
    }

    const { candidates, executionTimeMs } = await sourcingService.searchCandidates(
      platforms as SourcingPlatform[], criteria, tokens
    );

    const qualified = candidates.filter(c => c.matchScore >= (criteria.minMatchScore || 85));
    const avgScore = qualified.length > 0
      ? Math.round(qualified.reduce((s, c) => s + c.matchScore, 0) / qualified.length) : 0;

    await SourcingSearch.create({
      companyId, userId: req.user!._id, platforms, criteria,
      resultsCount: qualified.length, avgMatchScore: avgScore, executionTimeMs,
    });

    return sendSuccess(res, {
      candidates: qualified, count: qualified.length, totalScanned: candidates.length,
      platforms, criteria, executionTimeMs, avgMatchScore: avgScore,
    }, 'Candidates sourced successfully');
  } catch (error: any) {
    logger.error('Error in searchCandidates:', error);
    return sendError(res, error.message || 'Error sourcing candidates', 500);
  }
};

export const searchCandidatesForJob = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const { jobId } = req.params;
    const { platforms } = req.body;
    const companyId = getTenantCompanyId(req.user) || req.user?.companyId;
    if (!companyId) return sendError(res, 'Company context required', 400);

    const job = await Job.findById(jobId);
    if (!job) return sendError(res, 'Job not found', 404);

    const tenantId = getTenantCompanyId(req.user);
    if (tenantId && job.companyId.toString() !== tenantId) {
      return sendError(res, 'Not authorized to source for this job', 403);
    }

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return sendError(res, 'At least one platform must be specified', 400);
    }

    const criteria: SourcingCriteria = {
      keywords: [job.title, ...(job.skills || []).slice(0, 3)],
      skills: job.skills || [],
      location: job.location,
      experienceMin: job.experienceMin,
      experienceMax: job.experienceMax,
      maxResults: req.body.maxResults || 25,
      minMatchScore: req.body.minMatchScore || 85,
    };

    const integrations = await SourcingIntegration.find({
      companyId, platform: { $in: platforms },
      status: IntegrationStatus.CONNECTED, deletedAt: null,
    }).select('+accessToken');

    const tokens: Partial<Record<SourcingPlatform, string>> = {};
    for (const int of integrations) {
      try { tokens[int.platform as SourcingPlatform] = int.getDecryptedAccessToken(); } catch { /* noop */ }
    }

    const { candidates, executionTimeMs } = await sourcingService.searchCandidates(
      platforms as SourcingPlatform[], criteria, tokens
    );

    const withJobScores = candidates.map(c => {
      const matchDetails = sourcingService.calculateMatchForJob(c, {
        title: job.title, description: job.description, skills: job.skills || [],
        experienceMin: job.experienceMin || 0, experienceMax: job.experienceMax || 10, location: job.location,
      });
      return { ...c, matchScore: matchDetails.overallScore, matchDetails };
    });

    withJobScores.sort((a, b) => b.matchScore - a.matchScore);
    const qualified = withJobScores.filter(c => c.matchScore >= (criteria.minMatchScore || 85));

    await SourcingSearch.create({
      companyId, userId: req.user!._id, jobId, platforms, criteria,
      resultsCount: qualified.length,
      avgMatchScore: qualified.length > 0 ? Math.round(qualified.reduce((s, c) => s + c.matchScore, 0) / qualified.length) : 0,
      executionTimeMs,
    });

    return sendSuccess(res, {
      job: { id: job._id, title: job.title, skills: job.skills, location: job.location },
      candidates: qualified, count: qualified.length, totalScanned: candidates.length, platforms, executionTimeMs,
    }, 'Candidates sourced for job');
  } catch (error: any) {
    logger.error('Error in searchCandidatesForJob:', error);
    return sendError(res, error.message || 'Error sourcing candidates', 500);
  }
};

// ============================================================
// SOURCED CANDIDATE MANAGEMENT
// ============================================================

export const saveSourcedCandidate = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const companyId = getTenantCompanyId(req.user) || req.user?.companyId;
    if (!companyId) return sendError(res, 'Company context required', 400);

    const { candidate, jobId, status } = req.body;
    if (!candidate?.externalId || !candidate?.platform) {
      return sendError(res, 'Candidate externalId and platform required', 400);
    }

    const saved = await SourcedCandidate.findOneAndUpdate(
      { companyId, platform: candidate.platform, externalId: candidate.externalId },
      {
        companyId, sourcedBy: req.user!._id, jobId, platform: candidate.platform,
        externalId: candidate.externalId, name: candidate.name, email: candidate.email,
        phone: candidate.phone, location: candidate.location, currentCompany: candidate.currentCompany,
        currentPosition: candidate.currentPosition, experience: candidate.experience,
        skills: candidate.skills, education: candidate.education, summary: candidate.summary,
        profileUrl: candidate.profileUrl, resumeUrl: candidate.resumeUrl, imageUrl: candidate.imageUrl,
        matchScore: candidate.matchScore || 0, matchDetails: candidate.matchDetails,
        githubData: candidate.githubData, status: status || 'saved',
      },
      { upsert: true, new: true }
    );

    return sendSuccess(res, saved, 'Candidate saved');
  } catch (error: any) {
    logger.error('Error in saveSourcedCandidate:', error);
    return sendError(res, error.message || 'Failed to save candidate', 500);
  }
};

export const getSourcedCandidates = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const companyId = getTenantCompanyId(req.user) || req.user?.companyId;
    if (!companyId) return sendError(res, 'Company context required', 400);

    const { page = 1, limit = 20, status, jobId, platform } = req.query;
    const { pageNum, limitNum } = clampPagination(page, limit);

    const query: any = { companyId, deletedAt: null };
    if (status) query.status = status;
    if (jobId) query.jobId = jobId;
    if (platform) query.platform = platform;

    const [candidates, total] = await Promise.all([
      SourcedCandidate.find(query)
        .populate('sourcedBy', 'firstName lastName email')
        .populate('jobId', 'title')
        .sort({ matchScore: -1, createdAt: -1 })
        .skip((pageNum - 1) * limitNum).limit(limitNum),
      SourcedCandidate.countDocuments(query),
    ]);

    return sendPaginatedResponse(res, candidates, pageNum, limitNum, total, 'Sourced candidates retrieved');
  } catch (error: any) {
    logger.error('Error in getSourcedCandidates:', error);
    return sendError(res, error.message || 'Failed to get candidates', 500);
  }
};

export const updateCandidateStatus = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const companyId = getTenantCompanyId(req.user) || req.user?.companyId;
    if (!companyId) return sendError(res, 'Company context required', 400);

    const candidate = await SourcedCandidate.findOne({ _id: id, companyId, deletedAt: null });
    if (!candidate) return sendError(res, 'Candidate not found', 404);

    const validStatuses = ['sourced', 'shortlisted', 'contacted', 'responded', 'in_pipeline', 'rejected', 'saved'];
    if (!validStatuses.includes(status)) return sendError(res, `Invalid status`, 400);

    candidate.status = status;
    if (status === 'contacted') candidate.contactedAt = new Date();
    if (status === 'responded') candidate.respondedAt = new Date();
    if (note) {
      candidate.notes = candidate.notes || [];
      candidate.notes.push({ addedBy: req.user!._id as any, note, createdAt: new Date() });
    }
    await candidate.save();

    return sendSuccess(res, candidate, 'Candidate status updated');
  } catch (error: any) {
    logger.error('Error in updateCandidateStatus:', error);
    return sendError(res, error.message || 'Failed to update status', 500);
  }
};

export const getSourcingStats = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const companyId = getTenantCompanyId(req.user) || req.user?.companyId;
    if (!companyId) return sendError(res, 'Company context required', 400);

    const oid = new mongoose.Types.ObjectId(companyId);
    const [totalSourced, shortlisted, contacted, responded, inPipeline, platformBreakdown, recentSearches, avgScore] = await Promise.all([
      SourcedCandidate.countDocuments({ companyId, deletedAt: null }),
      SourcedCandidate.countDocuments({ companyId, status: 'shortlisted', deletedAt: null }),
      SourcedCandidate.countDocuments({ companyId, status: 'contacted', deletedAt: null }),
      SourcedCandidate.countDocuments({ companyId, status: 'responded', deletedAt: null }),
      SourcedCandidate.countDocuments({ companyId, status: 'in_pipeline', deletedAt: null }),
      SourcedCandidate.aggregate([
        { $match: { companyId: oid, deletedAt: null } },
        { $group: { _id: '$platform', count: { $sum: 1 } } },
      ]),
      SourcingSearch.find({ companyId }).sort({ createdAt: -1 }).limit(10)
        .select('platforms criteria resultsCount avgMatchScore executionTimeMs createdAt'),
      SourcedCandidate.aggregate([
        { $match: { companyId: oid, deletedAt: null } },
        { $group: { _id: null, avg: { $avg: '$matchScore' } } },
      ]),
    ]);

    const sourceBreakdown: Record<string, number> = {};
    platformBreakdown.forEach((p: any) => { sourceBreakdown[p._id] = p.count; });

    return sendSuccess(res, {
      totalCandidatesSourced: totalSourced, shortlisted, contacted, responded, inPipeline,
      sourceBreakdown, averageMatchScore: avgScore[0]?.avg ? Math.round(avgScore[0].avg) : 0,
      responseRate: contacted > 0 ? Math.round((responded / contacted) * 100) : 0,
      recentSearches,
    }, 'Sourcing statistics retrieved');
  } catch (error: any) {
    logger.error('Error in getSourcingStats:', error);
    return sendError(res, error.message || 'Error getting stats', 500);
  }
};

export const exportCandidates = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const companyId = getTenantCompanyId(req.user) || req.user?.companyId;
    if (!companyId) return sendError(res, 'Company context required', 400);

    const { status, jobId, format = 'json' } = req.query;
    const query: any = { companyId, deletedAt: null };
    if (status) query.status = status;
    if (jobId) query.jobId = jobId;

    const candidates = await SourcedCandidate.find(query).populate('jobId', 'title')
      .sort({ matchScore: -1 }).limit(500);

    if (format === 'csv') {
      const rows = [
        'Name,Email,Phone,Location,Company,Position,Experience,Skills,Platform,MatchScore,Status',
        ...candidates.map(c =>
          `"${c.name}","${c.email || ''}","${c.phone || ''}","${c.location || ''}","${c.currentCompany || ''}","${c.currentPosition || ''}",${c.experience || 0},"${c.skills.join('; ')}","${c.platform}",${c.matchScore},"${c.status}"`
        ),
      ];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=sourced-candidates.csv');
      return res.send(rows.join('\n'));
    }

    return sendSuccess(res, { candidates, count: candidates.length }, 'Candidates exported');
  } catch (error: any) {
    logger.error('Error in exportCandidates:', error);
    return sendError(res, error.message || 'Failed to export', 500);
  }
};
