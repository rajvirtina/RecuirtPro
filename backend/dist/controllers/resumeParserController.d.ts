import { Response } from 'express';
import { AuthRequest } from '../types';
/**
 * @desc   Parse resume for a single application via LLM
 * @route  POST /api/v1/applications/:id/parse-resume
 * @access HR / Admin / Employer
 */
export declare const parseResume: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc   Bulk-parse resumes for all applications with no parsedAt in a job
 * @route  POST /api/v1/jobs/:jobId/parse-all-resumes
 * @access HR / Admin / Employer
 */
export declare const parseAllResumes: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc   Rank all applications for a job using LLM scoring
 * @route  POST /api/v1/jobs/:jobId/rank-candidates
 * @access HR / Admin / Employer
 */
export declare const rankCandidates: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc   Bulk-parse resumes for a given list of application IDs (sequential, rate-limit safe)
 * @route  POST /api/v1/applications/bulk-parse
 * @access HR / Admin / Employer
 */
export declare const bulkParse: (req: AuthRequest, res: Response) => Promise<void | Response>;
//# sourceMappingURL=resumeParserController.d.ts.map