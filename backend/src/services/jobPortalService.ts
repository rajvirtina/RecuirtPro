/**
 * Service-layer job portal posting.
 * Called by queueProcessors and directly from updateJobStatus (fire-and-forget).
 */
import axios from 'axios';
import { Job, SourcingIntegration } from '../models';
import { SourcingPlatform } from '../types';
import { config } from '../config';
import { decrypt } from '../utils/encryption';
import logger from '../utils/logger';

export interface PortalResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

// ── Naukri ────────────────────────────────────────────────────────────────────

async function postJobToNaukri(job: any): Promise<PortalResult> {
  if (!config.naukri?.apiKey || !config.naukri?.apiSecret) {
    return { success: false, error: 'Naukri not configured' };
  }
  try {
    const authRes = await axios.post(
      `${config.naukri.baseUrl}/v1/auth/token`,
      { client_id: config.naukri.apiKey, client_secret: config.naukri.apiSecret, grant_type: 'client_credentials' },
      { timeout: 10_000 }
    );
    const accessToken: string = authRes.data?.access_token;
    if (!accessToken) throw new Error('No access token returned');

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
    if (job.salaryMin) payload.salary_min = Math.round(job.salaryMin / 100_000);
    if (job.salaryMax) payload.salary_max = Math.round(job.salaryMax / 100_000);
    if (job.expiryDate) payload.expiry_date = job.expiryDate.toISOString().slice(0, 10);

    const postRes = await axios.post(`${config.naukri.baseUrl}/v1/jobs`, payload, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      timeout: 15_000,
    });
    const externalId: string = postRes.data?.job_id || postRes.data?.id;
    return { success: true, externalId };
  } catch (err: any) {
    const msg = err.response?.data?.message || err.message;
    return { success: false, error: msg };
  }
}

// ── LinkedIn ──────────────────────────────────────────────────────────────────

async function postJobToLinkedIn(job: any): Promise<PortalResult> {
  try {
    const integration = await SourcingIntegration.findOne({
      companyId: job.companyId,
      platform:  SourcingPlatform.LINKEDIN,
      status:    'connected',
      deletedAt: null,
    }).select('+accessToken +refreshToken');

    if (!integration) return { success: false, error: 'LinkedIn integration not connected' };

    let accessToken: string;
    try {
      accessToken = decrypt(integration.accessToken);
    } catch {
      accessToken = integration.accessToken;
    }
    if (!accessToken) return { success: false, error: 'LinkedIn access token missing' };

    const organizationUrn = integration.metadata?.organizationUrn;
    if (!organizationUrn) return { success: false, error: 'organizationUrn not set on integration' };

    const payload: Record<string, any> = {
      companyApplyUrl:          `${config.frontendUrl}/jobs/${job._id}/apply`,
      description:              { text: job.description },
      employmentStatus:         'FULL_TIME',
      externalJobPostingId:     String(job._id),
      listedAt:                 Date.now(),
      location:                 { country: 'IN', description: { text: job.location || 'India' } },
      title:                    job.title,
      integrationContext:       `urn:li:jobPosting:${job._id}`,
      jobPostingOperationType:  'CREATE',
      workplaceTypes:           job.workMode === 'remote' ? ['urn:li:workplaceType:2'] : ['urn:li:workplaceType:1'],
      hiringOrganization:       { companyUrn: organizationUrn },
    };

    const postRes = await axios.post('https://api.linkedin.com/v2/simpleJobPostings', payload, {
      headers: {
        Authorization:                `Bearer ${accessToken}`,
        'Content-Type':               'application/json',
        'X-Restli-Protocol-Version':  '2.0.0',
      },
      timeout: 15_000,
    });

    const externalId: string =
      postRes.headers['x-restli-id'] ||
      postRes.data?.id ||
      String(postRes.data?.jobPostingId ?? '');

    return { success: true, externalId };
  } catch (err: any) {
    const msg = err.response?.data?.message || err.message;
    return { success: false, error: msg };
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function triggerPortalPosting(jobId: string, portal: 'naukri' | 'linkedin'): Promise<PortalResult> {
  const job = await Job.findById(jobId).lean();
  if (!job) return { success: false, error: 'Job not found' };

  const result = portal === 'naukri'
    ? await postJobToNaukri(job)
    : await postJobToLinkedIn(job);

  // Persist result on the job document
  if (result.success) {
    await Job.findByIdAndUpdate(jobId, {
      $push: {
        postings: { portal, postedAt: new Date(), externalId: result.externalId, status: 'posted' },
      },
    });
    logger.info(`[JobPortal] Job ${jobId} posted to ${portal}: ${result.externalId}`);
  } else {
    await Job.findByIdAndUpdate(jobId, {
      $push: { postings: { portal, status: 'failed', error: result.error } },
    }).catch(() => {/* non-fatal */});
    logger.warn(`[JobPortal] Failed to post job ${jobId} to ${portal}: ${result.error}`);
  }

  return result;
}

/**
 * Auto-trigger all pending portal postings for a job (call fire-and-forget on publish).
 * Reads pending portals from job.postings[] added by the Create Wizard.
 */
export async function triggerPendingPortalPostings(jobId: string): Promise<void> {
  const job = await Job.findById(jobId).lean();
  if (!job) return;

  const pending = ((job as any).postings || [])
    .filter((p: any) => p.status === 'pending' && (p.portal === 'naukri' || p.portal === 'linkedin'))
    .map((p: any) => p.portal as 'naukri' | 'linkedin');

  if (pending.length === 0) return;

  logger.info(`[JobPortal] Auto-posting job ${jobId} to: ${pending.join(', ')}`);
  await Promise.allSettled(pending.map((portal) => triggerPortalPosting(jobId, portal)));
}
