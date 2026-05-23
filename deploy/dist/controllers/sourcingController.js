"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportCandidates = exports.getSourcingStats = exports.updateCandidateStatus = exports.getSourcedCandidates = exports.saveSourcedCandidate = exports.searchCandidatesForJob = exports.searchCandidates = exports.disconnectIntegration = exports.oauthCallback = exports.initiateOAuth = exports.getIntegrations = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const types_1 = require("../types");
const response_1 = require("../utils/response");
const models_1 = require("../models");
const sourcingService_1 = require("../services/sourcingService");
const auth_1 = require("../middleware/auth");
const logger_1 = __importDefault(require("../utils/logger"));
// In-memory state store for OAuth (use Redis in production)
const oauthStates = new Map();
// ============================================================
// INTEGRATION MANAGEMENT
// ============================================================
const getIntegrations = async (req, res) => {
    try {
        const companyId = (0, auth_1.getTenantCompanyId)(req.user) || req.user?.companyId;
        if (!companyId)
            return (0, response_1.sendError)(res, 'Company context required', 400);
        const integrations = await models_1.SourcingIntegration.find({ companyId, deletedAt: null })
            .select('-accessToken -refreshToken');
        const platformStatus = Object.values(types_1.SourcingPlatform).map(platform => {
            const integration = integrations.find(i => i.platform === platform);
            return {
                platform,
                status: integration?.status || types_1.IntegrationStatus.DISCONNECTED,
                connectedBy: integration?.userId,
                externalUsername: integration?.externalUsername,
                tokenExpiresAt: integration?.tokenExpiresAt,
                lastSyncAt: integration?.lastSyncAt,
                isExpired: integration?.tokenExpiresAt ? new Date() > integration.tokenExpiresAt : false,
            };
        });
        return (0, response_1.sendSuccess)(res, { integrations: platformStatus }, 'Integrations retrieved');
    }
    catch (error) {
        logger_1.default.error('Error in getIntegrations:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to get integrations', 500);
    }
};
exports.getIntegrations = getIntegrations;
const initiateOAuth = async (req, res) => {
    try {
        const { platform } = req.params;
        if (!Object.values(types_1.SourcingPlatform).includes(platform)) {
            return (0, response_1.sendError)(res, `Invalid platform: ${platform}`, 400);
        }
        const companyId = (0, auth_1.getTenantCompanyId)(req.user) || req.user?.companyId;
        if (!companyId)
            return (0, response_1.sendError)(res, 'Company context required', 400);
        if (platform === types_1.SourcingPlatform.NAUKRI) {
            const { apiKey } = req.body;
            // In dev mode, allow connecting without a real API key (uses simulated data)
            const token = apiKey || 'dev-simulated';
            await models_1.SourcingIntegration.findOneAndUpdate({ userId: req.user._id, platform: types_1.SourcingPlatform.NAUKRI }, {
                companyId,
                userId: req.user._id,
                platform: types_1.SourcingPlatform.NAUKRI,
                status: types_1.IntegrationStatus.CONNECTED,
                accessToken: token,
                externalUsername: 'Naukri RMS',
            }, { upsert: true, new: true });
            return (0, response_1.sendSuccess)(res, { platform: 'naukri', status: 'connected' }, apiKey ? 'Naukri connected with API key' : 'Naukri connected in demo mode (simulated results)');
        }
        // If OAuth credentials are not configured, connect in demo mode
        if ((platform === types_1.SourcingPlatform.LINKEDIN && !process.env.LINKEDIN_CLIENT_ID) ||
            (platform === types_1.SourcingPlatform.GITHUB && !process.env.GITHUB_CLIENT_ID)) {
            await models_1.SourcingIntegration.findOneAndUpdate({ userId: req.user._id, platform }, {
                companyId,
                userId: req.user._id,
                platform,
                status: types_1.IntegrationStatus.CONNECTED,
                accessToken: 'dev-simulated',
                externalUsername: `${platform} Demo`,
            }, { upsert: true, new: true });
            return (0, response_1.sendSuccess)(res, { platform, status: 'connected' }, `${platform} connected in demo mode (simulated results)`);
        }
        const state = crypto_1.default.randomBytes(32).toString('hex');
        oauthStates.set(state, {
            userId: req.user._id,
            companyId,
            platform,
            expiresAt: Date.now() + 10 * 60 * 1000,
        });
        const authUrl = sourcingService_1.sourcingService.getOAuthUrl(platform, state);
        return (0, response_1.sendSuccess)(res, { authUrl, state }, 'OAuth URL generated');
    }
    catch (error) {
        logger_1.default.error('Error in initiateOAuth:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to initiate OAuth', 500);
    }
};
exports.initiateOAuth = initiateOAuth;
const oauthCallback = async (req, res) => {
    try {
        const { platform } = req.params;
        const { code, state, error: oauthError } = req.query;
        if (oauthError)
            return (0, response_1.sendError)(res, `OAuth error: ${oauthError}`, 400);
        if (!code || !state)
            return (0, response_1.sendError)(res, 'Missing code or state', 400);
        const stateData = oauthStates.get(state);
        if (!stateData || stateData.expiresAt < Date.now() || stateData.platform !== platform) {
            return (0, response_1.sendError)(res, 'Invalid or expired OAuth state', 400);
        }
        oauthStates.delete(state);
        const tokenData = await sourcingService_1.sourcingService.exchangeOAuthCode(platform, code);
        const tokenExpiresAt = tokenData.expiresIn ? new Date(Date.now() + tokenData.expiresIn * 1000) : undefined;
        await models_1.SourcingIntegration.findOneAndUpdate({ userId: stateData.userId, platform }, {
            companyId: stateData.companyId,
            userId: stateData.userId,
            platform,
            status: types_1.IntegrationStatus.CONNECTED,
            accessToken: tokenData.accessToken,
            refreshToken: tokenData.refreshToken,
            tokenExpiresAt,
            lastSyncAt: new Date(),
        }, { upsert: true, new: true });
        const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sourcing?connected=${platform}`;
        return res.redirect(redirectUrl);
    }
    catch (error) {
        logger_1.default.error('Error in oauthCallback:', error);
        const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sourcing?error=${encodeURIComponent(error.message)}`;
        return res.redirect(redirectUrl);
    }
};
exports.oauthCallback = oauthCallback;
const disconnectIntegration = async (req, res) => {
    try {
        const { platform } = req.params;
        const companyId = (0, auth_1.getTenantCompanyId)(req.user) || req.user?.companyId;
        if (!companyId)
            return (0, response_1.sendError)(res, 'Company context required', 400);
        const integration = await models_1.SourcingIntegration.findOne({ companyId, platform, deletedAt: null });
        if (!integration)
            return (0, response_1.sendError)(res, 'Integration not found', 404);
        integration.deletedAt = new Date();
        integration.status = types_1.IntegrationStatus.DISCONNECTED;
        await integration.save();
        return (0, response_1.sendSuccess)(res, null, `${platform} disconnected`);
    }
    catch (error) {
        logger_1.default.error('Error in disconnectIntegration:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to disconnect', 500);
    }
};
exports.disconnectIntegration = disconnectIntegration;
// ============================================================
// CANDIDATE SEARCH
// ============================================================
const searchCandidates = async (req, res) => {
    try {
        const { platforms, criteria: rawCriteria } = req.body;
        const companyId = (0, auth_1.getTenantCompanyId)(req.user) || req.user?.companyId;
        if (!companyId)
            return (0, response_1.sendError)(res, 'Company context required', 400);
        if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
            return (0, response_1.sendError)(res, 'At least one platform must be specified', 400);
        }
        const validPlatforms = Object.values(types_1.SourcingPlatform);
        const invalid = platforms.filter((p) => !validPlatforms.includes(p));
        if (invalid.length)
            return (0, response_1.sendError)(res, `Invalid platforms: ${invalid.join(', ')}`, 400);
        const criteria = {
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
        const integrations = await models_1.SourcingIntegration.find({
            companyId,
            platform: { $in: platforms },
            status: types_1.IntegrationStatus.CONNECTED,
            deletedAt: null,
        }).select('+accessToken');
        const tokens = {};
        for (const int of integrations) {
            try {
                tokens[int.platform] = int.getDecryptedAccessToken();
            }
            catch { /* noop */ }
        }
        const { candidates, executionTimeMs } = await sourcingService_1.sourcingService.searchCandidates(platforms, criteria, tokens);
        const qualified = candidates.filter(c => c.matchScore >= (criteria.minMatchScore || 85));
        const avgScore = qualified.length > 0
            ? Math.round(qualified.reduce((s, c) => s + c.matchScore, 0) / qualified.length) : 0;
        await models_1.SourcingSearch.create({
            companyId, userId: req.user._id, platforms, criteria,
            resultsCount: qualified.length, avgMatchScore: avgScore, executionTimeMs,
        });
        return (0, response_1.sendSuccess)(res, {
            candidates: qualified, count: qualified.length, totalScanned: candidates.length,
            platforms, criteria, executionTimeMs, avgMatchScore: avgScore,
        }, 'Candidates sourced successfully');
    }
    catch (error) {
        logger_1.default.error('Error in searchCandidates:', error);
        return (0, response_1.sendError)(res, error.message || 'Error sourcing candidates', 500);
    }
};
exports.searchCandidates = searchCandidates;
const searchCandidatesForJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        const { platforms } = req.body;
        const companyId = (0, auth_1.getTenantCompanyId)(req.user) || req.user?.companyId;
        if (!companyId)
            return (0, response_1.sendError)(res, 'Company context required', 400);
        const job = await models_1.Job.findById(jobId);
        if (!job)
            return (0, response_1.sendError)(res, 'Job not found', 404);
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        if (tenantId && job.companyId.toString() !== tenantId) {
            return (0, response_1.sendError)(res, 'Not authorized to source for this job', 403);
        }
        if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
            return (0, response_1.sendError)(res, 'At least one platform must be specified', 400);
        }
        const criteria = {
            keywords: [job.title, ...(job.skills || []).slice(0, 3)],
            skills: job.skills || [],
            location: job.location,
            experienceMin: job.experienceMin,
            experienceMax: job.experienceMax,
            maxResults: req.body.maxResults || 25,
            minMatchScore: req.body.minMatchScore || 85,
        };
        const integrations = await models_1.SourcingIntegration.find({
            companyId, platform: { $in: platforms },
            status: types_1.IntegrationStatus.CONNECTED, deletedAt: null,
        }).select('+accessToken');
        const tokens = {};
        for (const int of integrations) {
            try {
                tokens[int.platform] = int.getDecryptedAccessToken();
            }
            catch { /* noop */ }
        }
        const { candidates, executionTimeMs } = await sourcingService_1.sourcingService.searchCandidates(platforms, criteria, tokens);
        const withJobScores = await Promise.all(candidates.map(async (c) => {
            const matchDetails = await sourcingService_1.sourcingService.calculateMatchForJob(c, {
                title: job.title, description: job.description, skills: job.skills || [],
                experienceMin: job.experienceMin || 0, experienceMax: job.experienceMax || 10, location: job.location,
            });
            return { ...c, matchScore: matchDetails.overallScore, matchDetails };
        }));
        withJobScores.sort((a, b) => b.matchScore - a.matchScore);
        const qualified = withJobScores.filter(c => c.matchScore >= (criteria.minMatchScore || 85));
        await models_1.SourcingSearch.create({
            companyId, userId: req.user._id, jobId, platforms, criteria,
            resultsCount: qualified.length,
            avgMatchScore: qualified.length > 0 ? Math.round(qualified.reduce((s, c) => s + c.matchScore, 0) / qualified.length) : 0,
            executionTimeMs,
        });
        return (0, response_1.sendSuccess)(res, {
            job: { id: job._id, title: job.title, skills: job.skills, location: job.location },
            candidates: qualified, count: qualified.length, totalScanned: candidates.length, platforms, executionTimeMs,
        }, 'Candidates sourced for job');
    }
    catch (error) {
        logger_1.default.error('Error in searchCandidatesForJob:', error);
        return (0, response_1.sendError)(res, error.message || 'Error sourcing candidates', 500);
    }
};
exports.searchCandidatesForJob = searchCandidatesForJob;
// ============================================================
// SOURCED CANDIDATE MANAGEMENT
// ============================================================
const saveSourcedCandidate = async (req, res) => {
    try {
        const companyId = (0, auth_1.getTenantCompanyId)(req.user) || req.user?.companyId;
        if (!companyId)
            return (0, response_1.sendError)(res, 'Company context required', 400);
        const { candidate, jobId, status } = req.body;
        if (!candidate?.externalId || !candidate?.platform) {
            return (0, response_1.sendError)(res, 'Candidate externalId and platform required', 400);
        }
        const saved = await models_1.SourcedCandidate.findOneAndUpdate({ companyId, platform: candidate.platform, externalId: candidate.externalId }, {
            companyId, sourcedBy: req.user._id, jobId, platform: candidate.platform,
            externalId: candidate.externalId, name: candidate.name, email: candidate.email,
            phone: candidate.phone, location: candidate.location, currentCompany: candidate.currentCompany,
            currentPosition: candidate.currentPosition, experience: candidate.experience,
            skills: candidate.skills, education: candidate.education, summary: candidate.summary,
            profileUrl: candidate.profileUrl, resumeUrl: candidate.resumeUrl, imageUrl: candidate.imageUrl,
            matchScore: candidate.matchScore || 0, matchDetails: candidate.matchDetails,
            githubData: candidate.githubData, status: status || 'saved',
        }, { upsert: true, new: true });
        return (0, response_1.sendSuccess)(res, saved, 'Candidate saved');
    }
    catch (error) {
        logger_1.default.error('Error in saveSourcedCandidate:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to save candidate', 500);
    }
};
exports.saveSourcedCandidate = saveSourcedCandidate;
const getSourcedCandidates = async (req, res) => {
    try {
        const companyId = (0, auth_1.getTenantCompanyId)(req.user) || req.user?.companyId;
        if (!companyId)
            return (0, response_1.sendError)(res, 'Company context required', 400);
        const { page = 1, limit = 20, status, jobId, platform } = req.query;
        const { pageNum, limitNum } = (0, response_1.clampPagination)(page, limit);
        const query = { companyId, deletedAt: null };
        if (status)
            query.status = status;
        if (jobId)
            query.jobId = jobId;
        if (platform)
            query.platform = platform;
        const [candidates, total] = await Promise.all([
            models_1.SourcedCandidate.find(query)
                .populate('sourcedBy', 'firstName lastName email')
                .populate('jobId', 'title')
                .sort({ matchScore: -1, createdAt: -1 })
                .skip((pageNum - 1) * limitNum).limit(limitNum),
            models_1.SourcedCandidate.countDocuments(query),
        ]);
        return (0, response_1.sendPaginatedResponse)(res, candidates, pageNum, limitNum, total, 'Sourced candidates retrieved');
    }
    catch (error) {
        logger_1.default.error('Error in getSourcedCandidates:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to get candidates', 500);
    }
};
exports.getSourcedCandidates = getSourcedCandidates;
const updateCandidateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, note } = req.body;
        const companyId = (0, auth_1.getTenantCompanyId)(req.user) || req.user?.companyId;
        if (!companyId)
            return (0, response_1.sendError)(res, 'Company context required', 400);
        const candidate = await models_1.SourcedCandidate.findOne({ _id: id, companyId, deletedAt: null });
        if (!candidate)
            return (0, response_1.sendError)(res, 'Candidate not found', 404);
        const validStatuses = ['sourced', 'shortlisted', 'contacted', 'responded', 'in_pipeline', 'rejected', 'saved'];
        if (!validStatuses.includes(status))
            return (0, response_1.sendError)(res, `Invalid status`, 400);
        candidate.status = status;
        if (status === 'contacted')
            candidate.contactedAt = new Date();
        if (status === 'responded')
            candidate.respondedAt = new Date();
        if (note) {
            candidate.notes = candidate.notes || [];
            candidate.notes.push({ addedBy: req.user._id, note, createdAt: new Date() });
        }
        await candidate.save();
        return (0, response_1.sendSuccess)(res, candidate, 'Candidate status updated');
    }
    catch (error) {
        logger_1.default.error('Error in updateCandidateStatus:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to update status', 500);
    }
};
exports.updateCandidateStatus = updateCandidateStatus;
const getSourcingStats = async (req, res) => {
    try {
        const companyId = (0, auth_1.getTenantCompanyId)(req.user) || req.user?.companyId;
        if (!companyId)
            return (0, response_1.sendError)(res, 'Company context required', 400);
        const oid = new mongoose_1.default.Types.ObjectId(companyId);
        const [totalSourced, shortlisted, contacted, responded, inPipeline, platformBreakdown, recentSearches, avgScore] = await Promise.all([
            models_1.SourcedCandidate.countDocuments({ companyId, deletedAt: null }),
            models_1.SourcedCandidate.countDocuments({ companyId, status: 'shortlisted', deletedAt: null }),
            models_1.SourcedCandidate.countDocuments({ companyId, status: 'contacted', deletedAt: null }),
            models_1.SourcedCandidate.countDocuments({ companyId, status: 'responded', deletedAt: null }),
            models_1.SourcedCandidate.countDocuments({ companyId, status: 'in_pipeline', deletedAt: null }),
            models_1.SourcedCandidate.aggregate([
                { $match: { companyId: oid, deletedAt: null } },
                { $group: { _id: '$platform', count: { $sum: 1 } } },
            ]),
            models_1.SourcingSearch.find({ companyId }).sort({ createdAt: -1 }).limit(10)
                .select('platforms criteria resultsCount avgMatchScore executionTimeMs createdAt'),
            models_1.SourcedCandidate.aggregate([
                { $match: { companyId: oid, deletedAt: null } },
                { $group: { _id: null, avg: { $avg: '$matchScore' } } },
            ]),
        ]);
        const sourceBreakdown = {};
        platformBreakdown.forEach((p) => { sourceBreakdown[p._id] = p.count; });
        return (0, response_1.sendSuccess)(res, {
            totalCandidatesSourced: totalSourced, shortlisted, contacted, responded, inPipeline,
            sourceBreakdown, averageMatchScore: avgScore[0]?.avg ? Math.round(avgScore[0].avg) : 0,
            responseRate: contacted > 0 ? Math.round((responded / contacted) * 100) : 0,
            recentSearches,
        }, 'Sourcing statistics retrieved');
    }
    catch (error) {
        logger_1.default.error('Error in getSourcingStats:', error);
        return (0, response_1.sendError)(res, error.message || 'Error getting stats', 500);
    }
};
exports.getSourcingStats = getSourcingStats;
const exportCandidates = async (req, res) => {
    try {
        const companyId = (0, auth_1.getTenantCompanyId)(req.user) || req.user?.companyId;
        if (!companyId)
            return (0, response_1.sendError)(res, 'Company context required', 400);
        const { status, jobId, format = 'json' } = req.query;
        const query = { companyId, deletedAt: null };
        if (status)
            query.status = status;
        if (jobId)
            query.jobId = jobId;
        const candidates = await models_1.SourcedCandidate.find(query).populate('jobId', 'title')
            .sort({ matchScore: -1 }).limit(500);
        if (format === 'csv') {
            const rows = [
                'Name,Email,Phone,Location,Company,Position,Experience,Skills,Platform,MatchScore,Status',
                ...candidates.map(c => `"${c.name}","${c.email || ''}","${c.phone || ''}","${c.location || ''}","${c.currentCompany || ''}","${c.currentPosition || ''}",${c.experience || 0},"${c.skills.join('; ')}","${c.platform}",${c.matchScore},"${c.status}"`),
            ];
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=sourced-candidates.csv');
            return res.send(rows.join('\n'));
        }
        return (0, response_1.sendSuccess)(res, { candidates, count: candidates.length }, 'Candidates exported');
    }
    catch (error) {
        logger_1.default.error('Error in exportCandidates:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to export', 500);
    }
};
exports.exportCandidates = exportCandidates;
//# sourceMappingURL=sourcingController.js.map