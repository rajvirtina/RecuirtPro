"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rankCandidates = exports.parseAllResumes = exports.parseResume = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../models");
const response_1 = require("../utils/response");
const auth_1 = require("../middleware/auth");
const config_1 = __importDefault(require("../config"));
const logger_1 = __importDefault(require("../utils/logger"));
// ─── LLM client (reuse pattern from aiInterviewController) ───────────────────
const llm = axios_1.default.create({
    baseURL: config_1.default.llm.serviceUrl,
    timeout: 60000,
    headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config_1.default.llm.apiSecretKey,
    },
});
// ─── File reading helpers ─────────────────────────────────────────────────────
/** Resolve a stored resumeUrl to an absolute filesystem path */
function resolveResumePath(resumeUrl) {
    // resumeUrl is stored as /uploads/resumes/filename.pdf
    if (path_1.default.isAbsolute(resumeUrl))
        return resumeUrl;
    return path_1.default.resolve(process.cwd(), resumeUrl.replace(/^\//, ''));
}
/** Extract plain text from a PDF or DOCX/DOC resume file */
async function extractResumeText(resumeUrl) {
    const filePath = resolveResumePath(resumeUrl);
    if (!fs_1.default.existsSync(filePath)) {
        throw new Error(`Resume file not found at path: ${filePath}`);
    }
    const ext = path_1.default.extname(filePath).toLowerCase();
    const buffer = fs_1.default.readFileSync(filePath);
    if (ext === '.pdf') {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        return data.text;
    }
    if (ext === '.docx' || ext === '.doc') {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mammoth = require('mammoth');
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
const parseResume = async (req, res) => {
    try {
        const { id } = req.params;
        const application = await models_1.Application.findById(id)
            .populate('jobId', 'title skills')
            .lean();
        if (!application || application.deletedAt) {
            return (0, response_1.sendError)(res, 'Application not found', 404);
        }
        // Tenant isolation
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        if (tenantId && application.companyId?.toString() !== tenantId && !(0, auth_1.isSuperAdmin)(req.user)) {
            return (0, response_1.sendError)(res, 'Not authorised to parse this application', 403);
        }
        if (!application.resumeUrl) {
            return (0, response_1.sendError)(res, 'No resume uploaded for this application', 400);
        }
        // Extract text from file
        let resumeText = '';
        try {
            resumeText = await extractResumeText(application.resumeUrl);
        }
        catch (fileErr) {
            logger_1.default.warn(`Resume file read failed for ${id}: ${fileErr.message}`);
            return (0, response_1.sendError)(res, `Could not read resume file: ${fileErr.message}`, 400);
        }
        if (!resumeText.trim()) {
            return (0, response_1.sendError)(res, 'Resume file appears to be empty or unreadable', 400);
        }
        // Call LLM service — truncate to 5 000 chars to stay within token budget
        let parsed = {
            skills: [],
            years_experience: null,
            education: [],
            notice_period: null,
        };
        try {
            const llmRes = await llm.post('/api/parse-resume', {
                resume_text: resumeText.slice(0, 5000),
            });
            parsed = llmRes.data ?? parsed;
        }
        catch (llmErr) {
            logger_1.default.warn(`LLM parse-resume failed for ${id}: ${llmErr.message} — storing empty data`);
        }
        const update = {
            parsedSkills: Array.isArray(parsed.skills) ? parsed.skills.filter(Boolean) : [],
            parsedExperienceYears: typeof parsed.years_experience === 'number' ? parsed.years_experience : undefined,
            parsedEducation: Array.isArray(parsed.education) ? parsed.education.filter((e) => e?.degree || e?.institution) : [],
            parsedNoticePeriod: typeof parsed.notice_period === 'string' && parsed.notice_period ? parsed.notice_period : undefined,
            parsedAt: new Date(),
        };
        await models_1.Application.findByIdAndUpdate(id, { $set: update });
        logger_1.default.info(`Resume parsed for application ${id}: ${update.parsedSkills.length} skills extracted`);
        return (0, response_1.sendSuccess)(res, {
            applicationId: id,
            parsedSkills: update.parsedSkills,
            parsedExperienceYears: update.parsedExperienceYears,
            parsedEducation: update.parsedEducation,
            parsedNoticePeriod: update.parsedNoticePeriod,
            parsedAt: update.parsedAt,
        }, 'Resume parsed successfully');
    }
    catch (error) {
        logger_1.default.error('parseResume error:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to parse resume', 500);
    }
};
exports.parseResume = parseResume;
/**
 * @desc   Bulk-parse resumes for all applications with no parsedAt in a job
 * @route  POST /api/v1/jobs/:jobId/parse-all-resumes
 * @access HR / Admin / Employer
 */
const parseAllResumes = async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await models_1.Job.findById(jobId).lean();
        if (!job)
            return (0, response_1.sendError)(res, 'Job not found', 404);
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        if (tenantId && job.companyId?.toString() !== tenantId) {
            return (0, response_1.sendError)(res, 'Not authorised', 403);
        }
        // Find applications with a resume that haven't been parsed yet
        const apps = await models_1.Application.find({
            jobId: new mongoose_1.default.Types.ObjectId(jobId),
            deletedAt: null,
            resumeUrl: { $exists: true, $nin: [null, ''] },
            parsedAt: { $exists: false },
        }).lean();
        if (apps.length === 0) {
            return (0, response_1.sendSuccess)(res, { parsed: 0, skipped: 0 }, 'All resumes already parsed or no resumes found');
        }
        let parsed = 0;
        let failed = 0;
        for (const app of apps) {
            try {
                const resumeText = await extractResumeText(app.resumeUrl);
                if (!resumeText.trim()) {
                    failed++;
                    continue;
                }
                const llmRes = await llm.post('/api/parse-resume', {
                    resume_text: resumeText.slice(0, 5000),
                });
                const data = llmRes.data ?? {};
                await models_1.Application.findByIdAndUpdate(app._id, {
                    $set: {
                        parsedSkills: Array.isArray(data.skills) ? data.skills.filter(Boolean) : [],
                        parsedExperienceYears: typeof data.years_experience === 'number' ? data.years_experience : undefined,
                        parsedEducation: Array.isArray(data.education) ? data.education : [],
                        parsedNoticePeriod: data.notice_period || undefined,
                        parsedAt: new Date(),
                    },
                });
                parsed++;
            }
            catch (err) {
                logger_1.default.warn(`Bulk parse failed for ${app._id}: ${err.message}`);
                failed++;
            }
        }
        return (0, response_1.sendSuccess)(res, { parsed, failed }, `Parsed ${parsed} resumes${failed ? `, ${failed} failed` : ''}`);
    }
    catch (error) {
        logger_1.default.error('parseAllResumes error:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to bulk-parse resumes', 500);
    }
};
exports.parseAllResumes = parseAllResumes;
/**
 * @desc   Rank all applications for a job using LLM scoring
 * @route  POST /api/v1/jobs/:jobId/rank-candidates
 * @access HR / Admin / Employer
 */
const rankCandidates = async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await models_1.Job.findById(jobId).lean();
        if (!job)
            return (0, response_1.sendError)(res, 'Job not found', 404);
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        if (tenantId && job.companyId?.toString() !== tenantId) {
            return (0, response_1.sendError)(res, 'Not authorised to rank candidates for this job', 403);
        }
        // Find applications that have been parsed
        const applications = await models_1.Application.find({
            jobId: new mongoose_1.default.Types.ObjectId(jobId),
            deletedAt: null,
            parsedAt: { $exists: true },
        })
            .populate('candidateId', 'firstName lastName email')
            .lean();
        if (applications.length === 0) {
            return (0, response_1.sendError)(res, 'No applications with parsed resumes found. Parse resumes first using POST /applications/:id/parse-resume.', 400);
        }
        const jobDescription = job.description.slice(0, 2000);
        const requiredSkills = job.skills ?? [];
        // Score each application concurrently (max 5 at a time to avoid LLM rate limits)
        const CHUNK = 5;
        const results = [];
        for (let i = 0; i < applications.length; i += CHUNK) {
            const chunk = applications.slice(i, i + CHUNK);
            const settled = await Promise.allSettled(chunk.map(async (app) => {
                // Build a short profile summary from parsed data for the LLM
                const profileLines = [
                    `Skills: ${app.parsedSkills?.join(', ') || 'Not specified'}`,
                    `Experience: ${app.parsedExperienceYears != null ? `${app.parsedExperienceYears} years` : 'Unknown'}`,
                    `Education: ${app.parsedEducation?.map((e) => `${e.degree} from ${e.institution}`).join('; ') || 'Not specified'}`,
                    `Notice Period: ${app.parsedNoticePeriod || 'Not specified'}`,
                ];
                let scores = { skill_match_pct: 50, experience_fit: 50, overall_fit: 50, missing_skills: [], matching_skills: [] };
                try {
                    const llmRes = await llm.post('/api/rank-candidate', {
                        job_description: jobDescription,
                        resume_text: profileLines.join('\n'),
                        required_skills: requiredSkills,
                    });
                    const d = llmRes.data ?? {};
                    scores = {
                        skill_match_pct: Number(d.skill_match_pct) || 50,
                        experience_fit: Number(d.experience_fit) || 50,
                        overall_fit: Number(d.overall_fit) || 50,
                        missing_skills: Array.isArray(d.missing_skills) ? d.missing_skills : [],
                        matching_skills: Array.isArray(d.matching_skills) ? d.matching_skills : [],
                    };
                }
                catch (llmErr) {
                    logger_1.default.warn(`Rank LLM failed for ${app._id}: ${llmErr.message}`);
                }
                await models_1.Application.findByIdAndUpdate(app._id, {
                    $set: {
                        skillMatchScore: scores.skill_match_pct,
                        experienceMatchScore: scores.experience_fit,
                        overallScore: scores.overall_fit,
                        missingSkills: scores.missing_skills,
                        matchingSkills: scores.matching_skills,
                    },
                });
                return { ...app, ...scores };
            }));
            settled.forEach(r => {
                if (r.status === 'fulfilled')
                    results.push(r.value);
                else
                    logger_1.default.warn('Rank settled rejection:', r.reason);
            });
        }
        // Sort descending by overall_fit
        results.sort((a, b) => (b.overall_fit ?? 0) - (a.overall_fit ?? 0));
        logger_1.default.info(`Ranked ${results.length} candidates for job ${jobId}`);
        return (0, response_1.sendSuccess)(res, results, `Ranked ${results.length} candidate${results.length !== 1 ? 's' : ''}`);
    }
    catch (error) {
        logger_1.default.error('rankCandidates error:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to rank candidates', 500);
    }
};
exports.rankCandidates = rankCandidates;
//# sourceMappingURL=resumeParserController.js.map