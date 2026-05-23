import { Response } from 'express';
import { AuthRequest } from '../types';
/**
 * @desc    Get notes for an application
 * @route   GET /api/v1/applications/:id/notes
 */
export declare const getNotes: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @desc    Create a note for an application
 * @route   POST /api/v1/applications/:id/notes
 */
export declare const createNote: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @desc    Soft delete a note (author or admin only)
 * @route   DELETE /api/v1/applications/:id/notes/:noteId
 */
export declare const deleteNote: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * @desc    Get activity timeline for an application
 * @route   GET /api/v1/applications/:id/timeline
 */
export declare const getTimeline: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=noteController.d.ts.map