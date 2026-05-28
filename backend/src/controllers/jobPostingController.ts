/**
 * External job board posting controller.
 * Handles posting jobs to Naukri.com and LinkedIn via their respective APIs.
 */

import axios from 'axios';
import { Response } from 'express';
import { Job, SourcingIntegration } from '../models';
import { AuthRequest, SourcingPlatform } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import { getTenantCompanyId } from '../middleware/auth';
import config from '../config';
import logger from '../utils/logger';

// ─── Naukri ───────────────────────────────────────────────────────────────────

/**
 * @desc  Post a job to Naukri.com via the Naukri Job Posting API
 * @route POST /api/v1/jobs/:id/post/naukri
 * @auth  HR / Employer / Admin
 */
export const postToNaukri = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  const { id: jobId } = req.params;

  if (!config.naukri?.apiKey || !config.naukri?.apiSecret) {
    return sendError(res, 'Naukri integration is not configured. Set NAUKRI_API_KEY and NAUKRI_API_SECRET.', 503);
  }

  try {
    const tenantId = getTenantCompanyId(req.user);
    const job = await Job.findById(jobId).lean();
    if (!job) return sendError(res, 'Job not found', 404);
    if (tenantId && job.companyId.toString() !== tenantId) {
      return sendError(res, 'Not authorised', 403);
    }
    if (job.status !== 'published') {
      return sendError(res, 'Only published jobs can be posted to external boards', 400);
    }

    // Check if already posted
    const existing = job.postings?.find(p => p.portal === 'naukri' && p.status === 'posted');
    if (existing) {
      return sendSuccess(res, { externalId: existing.externalId, alreadyPosted: true }, 'Job already posted to Naukri');
    }

    // Get Naukri auth token (client-credentials flow)
    const authRes = await axios.post(
      `${config.naukri.baseUrl}/v1/auth/token`,
      { client_id: config.naukri.apiKey, client_secret: config.naukri.apiSecret, grant_type: 'client_credentials' },
      { timeout: 10_000 }
    );
    const accessToken: string = authRes.data?.access_token;
    if (!accessToken) throw new Error('Naukri auth token not received');

    // Build job payload (Naukri Job Posting API v2 schema)
    const salaryMin = job.salaryMin ? Math.round(job.salaryMin / 100_000) : undefined;
    const salaryMax = job.salaryMax ? Math.round(job.salaryMax / 100_000) : undefined;

    const payload: Record<string, any> = {
      title:          job.title,
      description:    job.description,
      location:       job.location || 'India',
      experience_min: job.experienceMin ?? 0,
      experience_max: job.experienceMax ?? 10,
      skills:         job.skills?.join(', ') || '',
      job_type:       job.jobType === 'full_time' ? 'Permanent' : 'Contract',
      work_mode:      job.workMode === 'remote' ? 'Work From Home' : 'Work From Office',
      vacancy:        job.positions ?? 1,
    };
    if (salaryMin) payload.salary_min = salaryMin;
    if (salaryMax) payload.salary_max = salaryMax;
    if (job.expiryDate) payload.expiry_date = job.expiryDate.toISOString().slice(0, 10);

    const postRes = await axios.post(
      `${config.naukri.baseUrl}/v1/jobs`,
      payload,
      {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        timeout: 15_000,
      }
    );

    const externalId: string = postRes.data?.job_id || postRes.data?.id;

    // Persist posting record on the job
    await Job.findByIdAndUpdate(jobId, {
      $push: {
        postings: {
          portal:     'naukri',
          postedAt:   new Date(),
          externalId,
          status:     'posted',
        },
      },
    });

    logger.info(`Job ${jobId} posted to Naukri: externalId=${externalId}`);
    return sendSuccess(res, { externalId, portal: 'naukri' }, 'Job posted to Naukri successfully', 201);
  } catch (error: any) {
    const msg = error.response?.data?.message || error.message || 'Failed to post job to Naukri';
    logger.error(`postToNaukri error for job ${jobId}:`, error?.response?.data || error.message);

    // Record failure on the job
    await Job.findByIdAndUpdate(jobId, {
      $push: {
        postings: {
          portal: 'naukri',
          status:  'failed',
          error:   msg,
        },
      },
    }).catch(() => {/* non-fatal */});

    return sendError(res, msg, error.response?.status || 500);
  }
};

// ─── LinkedIn ─────────────────────────────────────────────────────────────────

/**
 * @desc  Post a job to LinkedIn via the LinkedIn Jobs Posting API (Marketing API v2)
 * @route POST /api/v1/jobs/:id/post/linkedin
 * @auth  HR / Employer / Admin
 *
 * Prerequisites:
 *  - The company must have a connected LinkedIn SourcingIntegration (OAuth2)
 *    with scopes: r_organization_admin, w_member_social, w_organization_social
 *  - `metadata.organizationUrn` must be set on the integration record
 *    (format: "urn:li:organization:12345678")
 */
export const postToLinkedIn = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  const { id: jobId } = req.params;

  try {
    const tenantId = getTenantCompanyId(req.user);
    const job = await Job.findById(jobId).lean();
    if (!job) return sendError(res, 'Job not found', 404);
    if (tenantId && job.companyId.toString() !== tenantId) {
      return sendError(res, 'Not authorised', 403);
    }
    if (job.status !== 'published') {
      return sendError(res, 'Only published jobs can be posted to external boards', 400);
    }

    // Check if already posted
    const existing = job.postings?.find(p => p.portal === 'linkedin' && p.status === 'posted');
    if (existing) {
      return sendSuccess(res, { externalId: existing.externalId, alreadyPosted: true }, 'Job already posted to LinkedIn');
    }

    // Find LinkedIn OAuth token for this company
    const integration = await SourcingIntegration.findOne({
      companyId: job.companyId,
      platform:  SourcingPlatform.LINKEDIN,
      status:    'connected',
      deletedAt: null,
    }).select('+accessToken +refreshToken');

    if (!integration) {
      return sendError(
        res,
        'LinkedIn integration not connected. Go to Settings → Integrations to connect LinkedIn.',
        400
      );
    }

    const accessToken = integration.getDecryptedAccessToken();
    if (!accessToken) {
      return sendError(res, 'LinkedIn access token is missing. Please reconnect LinkedIn.', 400);
    }

    const organizationUrn: string = integration.metadata?.organizationUrn;
    if (!organizationUrn) {
      return sendError(
        res,
        'LinkedIn organization URN not configured. Set metadata.organizationUrn on the integration (e.g. "urn:li:organization:12345678").',
        400
      );
    }

    // Build LinkedIn Job Posting payload (LinkedIn Jobs API v2)
    const liPayload: Record<string, any> = {
      companyApplyUrl: `${config.frontendUrl}/jobs/${jobId}/apply`,
      description:     { text: job.description },
      employmentStatus: 'FULL_TIME',
      externalJobPostingId: jobId,
      listedAt:        Date.now(),
      location:        { country: 'IN', description: { text: job.location || 'India' } },
      title:           job.title,
      integrationContext: `urn:li:jobPosting:${jobId}`,
      jobPostingOperationType: 'CREATE',
      workplaceTypes:  job.workMode === 'remote' ? ['urn:li:workplaceType:2'] : ['urn:li:workplaceType:1'],
    };

    if (organizationUrn) {
      liPayload.hiringOrganization = { companyUrn: organizationUrn };
    }

    const postRes = await axios.post(
      'https://api.linkedin.com/v2/simpleJobPostings',
      liPayload,
      {
        headers: {
          Authorization:   `Bearer ${accessToken}`,
          'Content-Type':  'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        timeout: 15_000,
      }
    );

    // LinkedIn returns the job posting URN in the header or body
    const externalId: string =
      postRes.headers['x-restli-id'] ||
      postRes.data?.id ||
      String(postRes.data?.jobPostingId ?? '');

    await Job.findByIdAndUpdate(jobId, {
      $push: {
        postings: {
          portal:     'linkedin',
          postedAt:   new Date(),
          externalId,
          status:     'posted',
        },
      },
    });

    logger.info(`Job ${jobId} posted to LinkedIn: externalId=${externalId}`);
    return sendSuccess(res, { externalId, portal: 'linkedin' }, 'Job posted to LinkedIn successfully', 201);
  } catch (error: any) {
    const msg = error.response?.data?.message || error.response?.data?.serviceErrorCode
      ? `LinkedIn API error: ${error.response?.data?.message || error.response?.data?.serviceErrorCode}`
      : error.message || 'Failed to post job to LinkedIn';

    logger.error(`postToLinkedIn error for job ${jobId}:`, error?.response?.data || error.message);

    await Job.findByIdAndUpdate(jobId, {
      $push: {
        postings: {
          portal: 'linkedin',
          status:  'failed',
          error:   msg,
        },
      },
    }).catch(() => {/* non-fatal */});

    return sendError(res, msg, error.response?.status || 500);
  }
};

/**
 * @desc  Get external posting status for a job
 * @route GET /api/v1/jobs/:id/postings
 * @auth  HR / Employer / Admin
 */
export const getJobPostings = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const { id: jobId } = req.params;
    const tenantId = getTenantCompanyId(req.user);

    const job = await Job.findById(jobId).select('postings companyId').lean();
    if (!job) return sendError(res, 'Job not found', 404);
    if (tenantId && job.companyId.toString() !== tenantId) {
      return sendError(res, 'Not authorised', 403);
    }

    return sendSuccess(res, { postings: job.postings || [] }, 'Job postings retrieved');
  } catch (error: any) {
    logger.error('getJobPostings error:', error);
    return sendError(res, error.message || 'Failed to retrieve postings', 500);
  }
};
