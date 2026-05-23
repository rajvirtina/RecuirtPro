import { Request, Response } from 'express';
/**
 * Generate a self-schedule link for a candidate
 * POST /api/v1/schedule/generate/:interviewId
 */
export declare const generateSelfScheduleLink: (req: Request, res: Response) => Promise<void>;
/**
 * Get schedule data by token (public, no auth required)
 * GET /api/v1/schedule/:token
 */
export declare const getScheduleByToken: (req: Request, res: Response) => Promise<void>;
/**
 * Book a slot (public, no auth required)
 * POST /api/v1/schedule/:token/book
 */
export declare const bookSlot: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=scheduleController.d.ts.map