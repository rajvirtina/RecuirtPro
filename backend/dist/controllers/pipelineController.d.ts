import { Response } from 'express';
import { AuthRequest } from '../types';
/**
 * @desc    Get pipeline — applications grouped by status
 * @route   GET /api/v1/pipeline?jobId=<optional>
 * @access  Private (HR / Employer / Admin / Interviewer)
 */
export declare const getPipeline: (req: AuthRequest, res: Response) => Promise<void | Response>;
//# sourceMappingURL=pipelineController.d.ts.map