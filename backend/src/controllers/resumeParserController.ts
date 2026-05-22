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

    const update = {
      parsedSkills:          Array.isArray(parsed.skills)    ? parsed.skills.filter(Boolean)    : [],
      parsedExperienceYears: typeof parsed.years_experience === 'number' ? parsed.years_experience : undefined,
      parsedEducation:       Array.isArray(parsed.education) ? parsed.education.filter((e: any) => e?.degree || e?.institution) : [],
      parsedNoticePeriod:    typeof parsed.notice_period === 'string' && parsed.notice_period ? parsed.notice_period : undefined,
      parsedAt:              new Date(),
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
      applicationId:        id,
      parsedSkills:         update.parsedSkills,
      parsedExperienceYears:update.parsedExperienceYears,
      parsedEducation:      update.parsedEducation,
      parsedNoticePeriod:   update.parsedNoticePeriod,
      parsedAt:             update.parsedAt,
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

    const jobDescription  = job.description.slice(0, 2000);
    const requiredSkills  = job.skills ?? [];

    // Score each application concurrently (max 5 at a time to avoid LLM rate limits)
    const CHUNK = 5;
    const results: any[] = [];

    for (let i = 0; i < applications.length; i += CHUNK) {
      const chunk = applications.slice(i, i + CHUNK);
      const settled = await Promise.allSettled(
        chunk.map(async (app) => {
          // Build a short profile summary from parsed data for the LLM
          const profileLines = [
            `Skills: ${app.parsedSkills?.join(', ') || 'Not specified'}`,
            `Experience: ${app.parsedExperienceYears != null ? `${app.parsedExperienceYears} years` : 'Unknown'}`,
            `Education: ${app.parsedEducation?.map((e: any) => `${e.degree} from ${e.institution}`).join('; ') || 'Not specified'}`,
            `Notice Period: ${app.parsedNoticePeriod || 'Not specified'}`,
          ];

          let scores = { skill_match_pct: 50, experience_fit: 50, overall_fit: 50, missing_skills: [] as string[], matching_skills: [] as string[] };

          try {
            const llmRes = await llm.post('/api/rank-candidate', {
              job_description: jobDescription,
              resume_text:     profileLines.join('\n'),
              required_skills: requiredSkills,
            });
            const d = llmRes.data ?? {};
            scores = {
              skill_match_pct: Number(d.skill_match_pct) || 50,
              experience_fit:  Number(d.experience_fit)  || 50,
              overall_fit:     Number(d.overall_fit)     || 50,
              missing_skills:  Array.isArray(d.missing_skills)  ? d.missing_skills  : [],
              matching_skills: Array.isArray(d.matching_skills) ? d.matching_skills : [],
            };
          } catch (llmErr: any) {
            logger.warn(`Rank LLM failed for ${app._id}: ${llmErr.message}`);
          }

          await Application.findByIdAndUpdate(app._id, {
            $set: {
              skillMatchScore:  scores.skill_match_pct,
              experienceMatchScore: scores.experience_fit,
              overallScore:     scores.overall_fit,
              missingSkills:    scores.missing_skills,
              matchingSkills:   scores.matching_skills,
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
