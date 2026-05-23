import fs   from 'fs';
import path from 'path';
import axios from 'axios';
import { Response } from 'express';
import mongoose from 'mongoose';
import { Application, Job } from '../models';
import { AuthRequest }      from '../types';
import { sendSuccess, sendError } from '../utils/response';
import { getTenantCompanyId, isSuperAdmin } from '../middleware/auth';
import config from '../config';
import logger from '../utils/logger';
import { ActivityEvent } from '../models/ActivityEvent';

// ─── LLM client (reuse pattern from aiInterviewController) ───────────────────

const llm = axios.create({
  baseURL: config.llm.serviceUrl,
  timeout: 60_000,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': config.llm.apiSecretKey,
  },
});

// ─── File reading helpers ─────────────────────────────────────────────────────

/**
 * Resolve a stored resumeUrl to an absolute filesystem path.
 *
 * The upload middleware stores files at:
 *   <backend>/uploads/resumes/<filename>
 *
 * This file compiles to <backend>/dist/controllers/resumeParserController.js,
 * so __dirname resolves to <backend>/dist/controllers/ and
 * two levels up (../../) gives us <backend>/, which is exactly where
 * the `uploads/` directory lives — regardless of process.cwd().
 *
 * Using __dirname is more reliable than process.cwd() in production
 * (Hostinger, Docker) where the working directory may differ from the
 * backend root.
 */
function resolveResumePath(resumeUrl: string): string {
  // __dirname = <backend>/dist/controllers  →  ../../ = <backend>/
  const backendRoot = path.join(__dirname, '..', '..');
  // Always treat resumeUrl as relative to backendRoot.
  // Strip any leading slash to prevent path.join from treating it as absolute.
  return path.join(backendRoot, resumeUrl.replace(/^\/+/, ''));
}

/** Extract plain text from a PDF or DOCX/DOC resume file */
async function extractResumeText(resumeUrl: string): Promise<string> {
  const filePath = resolveResumePath(resumeUrl);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Resume file not found at path: ${filePath}`);
  }

  const ext    = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);

  if (ext === '.pdf') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === '.docx' || ext === '.doc') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth = require('mammoth') as {
      extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // Plain text fallback (txt, rtf, etc.)
  return buffer.toString('utf-8');
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * @desc   Parse resume for a single application via LLM
 * @route  POST /api/v1/applications/:id/parse-resume
 * @access HR / Admin / Employer
 */
export const parseResume = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;

    const application = await Application.findById(id)
      .populate('jobId', 'title skills')
      .lean();

    if (!application || application.deletedAt) {
      return sendError(res, 'Application not found', 404);
    }

    // Tenant isolation
    const tenantId = getTenantCompanyId(req.user);
    if (tenantId && application.companyId?.toString() !== tenantId && !isSuperAdmin(req.user)) {
      return sendError(res, 'Not authorised to parse this application', 403);
    }

    if (!application.resumeUrl) {
      return sendError(res, 'No resume uploaded for this application', 400);
    }

    // Extract text from file
    let resumeText = '';
    try {
      resumeText = await extractResumeText(application.resumeUrl);
    } catch (fileErr: any) {
      logger.warn(`Resume file read failed for ${id}: ${fileErr.message}`);
      return sendError(res, `Could not read resume file: ${fileErr.message}`, 400);
    }

    if (!resumeText.trim()) {
      return sendError(res, 'Resume file appears to be empty or unreadable', 400);
    }

    // Call LLM service — truncate to 5 000 chars to stay within token budget
    let parsed: any = {
      skills:           [],
      years_experience: null,
      education:        [],
      notice_period:    null,
    };

    try {
      const llmRes = await llm.post('/api/parse-resume', {
        resume_text: resumeText.slice(0, 5000),
      });
      parsed = llmRes.data ?? parsed;
    } catch (llmErr: any) {
      logger.warn(`LLM parse-resume failed for ${id}: ${llmErr.message} — storing empty data`);
    }

    const update: Record<string, any> = {
      parsedSkills:          Array.isArray(parsed.skills)    ? parsed.skills.filter(Boolean)    : [],
      parsedExperienceYears: typeof parsed.years_experience === 'number' ? parsed.years_experience : undefined,
      parsedEducation:       Array.isArray(parsed.education) ? parsed.education.filter((e: any) => e?.degree || e?.institution) : [],
      parsedNoticePeriod:    typeof parsed.notice_period === 'string' && parsed.notice_period ? parsed.notice_period : undefined,
      parsedAt:              new Date(),
      // Rich fields added in v2
      parsedCurrentRole:    typeof parsed.current_role    === 'string' && parsed.current_role    ? parsed.current_role.trim()    : undefined,
      parsedCurrentCompany: typeof parsed.current_company === 'string' && parsed.current_company ? parsed.current_company.trim() : undefined,
      parsedWorkHistory:    Array.isArray(parsed.work_history) ? parsed.work_history.filter((w: any) => w?.company || w?.role).map((w: any) => ({
        company:        String(w.company || '').trim(),
        role:           String(w.role    || '').trim(),
        durationMonths: typeof w.duration_months === 'number' ? w.duration_months : undefined,
        highlights:     Array.isArray(w.highlights) ? w.highlights.filter(Boolean).slice(0, 3) : [],
      })) : [],
    };

    await Application.findByIdAndUpdate(id, { $set: update });

    // Log activity event
    await ActivityEvent.create({
      applicationId: id,
      actorId: req.user?._id,
      actorName: `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || 'System',
      type: 'resume_parsed',
      metadata: { parsedAt: update.parsedAt, skillCount: update.parsedSkills.length },
    });

    logger.info(`Resume parsed for application ${id}: ${update.parsedSkills.length} skills extracted`);

    return sendSuccess(res, {
      applicationId:         id,
      parsedSkills:          update.parsedSkills,
      parsedExperienceYears: update.parsedExperienceYears,
      parsedEducation:       update.parsedEducation,
      parsedNoticePeriod:    update.parsedNoticePeriod,
      parsedCurrentRole:     update.parsedCurrentRole,
      parsedCurrentCompany:  update.parsedCurrentCompany,
      parsedWorkHistory:     update.parsedWorkHistory,
      parsedAt:              update.parsedAt,
    }, 'Resume parsed successfully');
  } catch (error: any) {
    logger.error('parseResume error:', error);
    return sendError(res, error.message || 'Failed to parse resume', 500);
  }
};

/**
 * @desc   Bulk-parse resumes for all applications with no parsedAt in a job
 * @route  POST /api/v1/jobs/:jobId/parse-all-resumes
 * @access HR / Admin / Employer
 */
export const parseAllResumes = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { jobId } = req.params;

    const job = await Job.findById(jobId).lean();
    if (!job) return sendError(res, 'Job not found', 404);

    const tenantId = getTenantCompanyId(req.user);
    if (tenantId && job.companyId?.toString() !== tenantId) {
      return sendError(res, 'Not authorised', 403);
    }

    // Find applications with a resume that haven't been parsed yet
    const apps = await Application.find({
      jobId:     new mongoose.Types.ObjectId(jobId),
      deletedAt: null,
      resumeUrl: { $exists: true, $nin: [null, ''] },
      parsedAt:  { $exists: false },
    }).lean();

    if (apps.length === 0) {
      return sendSuccess(res, { parsed: 0, skipped: 0 }, 'All resumes already parsed or no resumes found');
    }

    let parsed = 0;
    let failed = 0;

    for (const app of apps) {
      try {
        const resumeText = await extractResumeText(app.resumeUrl!);
        if (!resumeText.trim()) { failed++; continue; }

        const llmRes = await llm.post('/api/parse-resume', {
          resume_text: resumeText.slice(0, 5000),
        });
        const data = llmRes.data ?? {};

        await Application.findByIdAndUpdate(app._id, {
          $set: {
            parsedSkills:          Array.isArray(data.skills) ? data.skills.filter(Boolean) : [],
            parsedExperienceYears: typeof data.years_experience === 'number' ? data.years_experience : undefined,
            parsedEducation:       Array.isArray(data.education) ? data.education : [],
            parsedNoticePeriod:    data.notice_period || undefined,
            parsedAt:              new Date(),
            parsedCurrentRole:    data.current_role    || undefined,
            parsedCurrentCompany: data.current_company || undefined,
            parsedWorkHistory:    Array.isArray(data.work_history) ? data.work_history : [],
          },
        });
        parsed++;
      } catch (err: any) {
        logger.warn(`Bulk parse failed for ${app._id}: ${err.message}`);
        failed++;
      }
    }

    return sendSuccess(res, { parsed, failed }, `Parsed ${parsed} resumes${failed ? `, ${failed} failed` : ''}`);
  } catch (error: any) {
    logger.error('parseAllResumes error:', error);
    return sendError(res, error.message || 'Failed to bulk-parse resumes', 500);
  }
};

/**
 * @desc   Rank all applications for a job using LLM scoring
 * @route  POST /api/v1/jobs/:jobId/rank-candidates
 * @access HR / Admin / Employer
 */
export const rankCandidates = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { jobId } = req.params;

    const job = await Job.findById(jobId).lean();
    if (!job) return sendError(res, 'Job not found', 404);

    const tenantId = getTenantCompanyId(req.user);
    if (tenantId && job.companyId?.toString() !== tenantId) {
      return sendError(res, 'Not authorised to rank candidates for this job', 403);
    }

    // Find applications that have been parsed
    const applications = await Application.find({
      jobId:     new mongoose.Types.ObjectId(jobId),
      deletedAt: null,
      parsedAt:  { $exists: true },
    })
      .populate('candidateId', 'firstName lastName email')
      .lean();

    if (applications.length === 0) {
      return sendError(
        res,
        'No applications with parsed resumes found. Parse resumes first using POST /applications/:id/parse-resume.',
        400
      );
    }

    const jobDescription    = job.description.slice(0, 2000);
    const requiredSkills    = job.skills ?? [];
    const experienceRequired = job.experienceMin ?? 0;

    // Score each application concurrently (max 5 at a time to avoid LLM rate limits)
    const CHUNK = 5;
    const results: any[] = [];

    for (let i = 0; i < applications.length; i += CHUNK) {
      const chunk = applications.slice(i, i + CHUNK);
      const settled = await Promise.allSettled(
        chunk.map(async (app) => {
          // Send structured candidate_profile — richer than raw text
          const candidateProfile = {
            skills:          app.parsedSkills ?? [],
            years_experience:app.parsedExperienceYears ?? null,
            current_role:    (app as any).parsedCurrentRole    ?? null,
            current_company: (app as any).parsedCurrentCompany ?? null,
            notice_period:   app.parsedNoticePeriod ?? null,
            education:       app.parsedEducation ?? [],
          };

          type Scores = {
            skill_match_pct: number; experience_fit: number; overall_fit: number;
            missing_skills: string[]; matching_skills: string[]; fit_summary: string | null;
          };
          let scores: Scores = {
            skill_match_pct: 50, experience_fit: 50, overall_fit: 50,
            missing_skills: [], matching_skills: [], fit_summary: null,
          };

          try {
            const llmRes = await llm.post('/api/rank-candidate', {
              job_description:     jobDescription,
              required_skills:     requiredSkills,
              experience_required: experienceRequired,
              candidate_profile:   candidateProfile,
            });
            const d = llmRes.data ?? {};
            scores = {
              skill_match_pct: Number(d.skill_match_pct) || 50,
              experience_fit:  Number(d.experience_fit)  || 50,
              overall_fit:     Number(d.overall_fit)     || 50,
              missing_skills:  Array.isArray(d.missing_skills)  ? d.missing_skills  : [],
              matching_skills: Array.isArray(d.matching_skills) ? d.matching_skills : [],
              fit_summary:     typeof d.fit_summary === 'string' ? d.fit_summary.trim() : null,
            };
          } catch (llmErr: any) {
            logger.warn(`Rank LLM failed for ${app._id}: ${llmErr.message}`);
          }

          await Application.findByIdAndUpdate(app._id, {
            $set: {
              skillMatchScore:      scores.skill_match_pct,
              experienceMatchScore: scores.experience_fit,
              overallScore:         scores.overall_fit,
              missingSkills:        scores.missing_skills,
              matchingSkills:       scores.matching_skills,
              ...(scores.fit_summary ? { aiFitSummary: scores.fit_summary } : {}),
            },
          });

          return { ...app, ...scores };
        })
      );

      settled.forEach(r => {
        if (r.status === 'fulfilled') results.push(r.value);
        else logger.warn('Rank settled rejection:', r.reason);
      });
    }

    // Sort descending by overall_fit
    results.sort((a, b) => (b.overall_fit ?? 0) - (a.overall_fit ?? 0));

    logger.info(`Ranked ${results.length} candidates for job ${jobId}`);
    return sendSuccess(res, results, `Ranked ${results.length} candidate${results.length !== 1 ? 's' : ''}`);
  } catch (error: any) {
    logger.error('rankCandidates error:', error);
    return sendError(res, error.message || 'Failed to rank candidates', 500);
  }
};

/**
 * @desc   Bulk-parse resumes for a given list of application IDs (sequential, rate-limit safe)
 * @route  POST /api/v1/applications/bulk-parse
 * @access HR / Admin / Employer
 */
export const bulkParse = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { applicationIds } = req.body as { applicationIds: string[] };

    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      return sendError(res, 'applicationIds must be a non-empty array', 400);
    }
    if (applicationIds.length > 50) {
      return sendError(res, 'Maximum 50 applications per bulk-parse request', 400);
    }

    const tenantId = getTenantCompanyId(req.user);

    let parsed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const id of applicationIds) {
      try {
        const application = await Application.findById(id).lean();

        if (!application || application.deletedAt) {
          errors.push(`${id}: not found`);
          failed++;
          continue;
        }

        if (tenantId && application.companyId?.toString() !== tenantId && !isSuperAdmin(req.user)) {
          errors.push(`${id}: unauthorized`);
          failed++;
          continue;
        }

        if (!application.resumeUrl) {
          errors.push(`${id}: no resume uploaded`);
          failed++;
          continue;
        }

        let resumeText = '';
        try {
          resumeText = await extractResumeText(application.resumeUrl);
        } catch (fileErr: any) {
          errors.push(`${id}: ${fileErr.message}`);
          failed++;
          continue;
        }

        if (!resumeText.trim()) {
          errors.push(`${id}: empty resume file`);
          failed++;
          continue;
        }

        let data: any = {};
        try {
          const llmRes = await llm.post('/api/parse-resume', {
            resume_text: resumeText.slice(0, 5000),
          });
          data = llmRes.data ?? {};
        } catch (llmErr: any) {
          logger.warn(`Bulk LLM parse failed for ${id}: ${llmErr.message}`);
        }

        await Application.findByIdAndUpdate(id, {
          $set: {
            parsedSkills:          Array.isArray(data.skills) ? data.skills.filter(Boolean) : [],
            parsedExperienceYears: typeof data.years_experience === 'number' ? data.years_experience : undefined,
            parsedEducation:       Array.isArray(data.education) ? data.education : [],
            parsedNoticePeriod:    data.notice_period || undefined,
            parsedAt:              new Date(),
            parsedCurrentRole:    data.current_role    || undefined,
            parsedCurrentCompany: data.current_company || undefined,
            parsedWorkHistory:    Array.isArray(data.work_history) ? data.work_history : [],
          },
        });
        parsed++;
      } catch (err: any) {
        logger.warn(`Bulk parse failed for ${id}: ${err.message}`);
        errors.push(`${id}: ${err.message}`);
        failed++;
      }
    }

    logger.info(`Bulk parse completed: ${parsed} parsed, ${failed} failed`);
    return sendSuccess(
      res,
      { parsed, failed, errors: errors.slice(0, 20) },
      `Parsed ${parsed} resume${parsed !== 1 ? 's' : ''}${failed ? `, ${failed} failed` : ''}`
    );
  } catch (error: any) {
    logger.error('bulkParse error:', error);
    return sendError(res, error.message || 'Bulk parse failed', 500);
  }
};
