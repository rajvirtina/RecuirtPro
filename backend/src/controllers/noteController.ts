import { Response } from 'express';
import { Note } from '../models/Note';
import { ActivityEvent } from '../models/ActivityEvent';
import { Application } from '../models';
import { AuthRequest } from '../types';
import { sendSuccess, sendError, sendPaginatedResponse, clampPagination } from '../utils/response';
import logger from '../utils/logger';
import { getTenantCompanyId } from '../middleware/auth';

/**
 * @desc    Get notes for an application
 * @route   GET /api/v1/applications/:id/notes
 */
export const getNotes = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = clampPagination(req.query);

    const query = { applicationId: id, deletedAt: null };
    const total = await Note.countDocuments(query);
    const notes = await Note.find(query)
      .sort({ createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit)
      .lean();

    return sendPaginatedResponse(res, notes, total, +page, +limit);
  } catch (error: any) {
    logger.error('Error in getNotes:', error);
    return sendError(res, error.message || 'Error fetching notes', 500);
  }
};

/**
 * @desc    Create a note for an application
 * @route   POST /api/v1/applications/:id/notes
 */
export const createNote = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content, mentions } = req.body;

    if (!content || content.trim().length === 0) {
      return sendError(res, 'Note content is required', 400);
    }
    if (content.length > 2000) {
      return sendError(res, 'Note content cannot exceed 2000 characters', 400);
    }

    // Verify application exists and user has access
    const companyId = getTenantCompanyId(req);
    const application = await Application.findOne({ _id: id, ...(companyId ? { companyId } : {}) });
    if (!application) {
      return sendError(res, 'Application not found', 404);
    }

    const authorName = `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || 'Unknown';

    const note = await Note.create({
      applicationId: id,
      authorId: req.user?._id,
      authorName,
      content: content.trim(),
      mentions: mentions || [],
    });

    // Auto-log activity event
    await ActivityEvent.create({
      applicationId: id,
      actorId: req.user?._id,
      actorName: authorName,
      type: 'note_added',
      metadata: { noteId: note._id },
    });

    return sendSuccess(res, note, 'Note created successfully', 201);
  } catch (error: any) {
    logger.error('Error in createNote:', error);
    return sendError(res, error.message || 'Error creating note', 500);
  }
};

/**
 * @desc    Soft delete a note (author or admin only)
 * @route   DELETE /api/v1/applications/:id/notes/:noteId
 */
export const deleteNote = async (req: AuthRequest, res: Response) => {
  try {
    const { noteId } = req.params;

    const note = await Note.findOne({ _id: noteId, deletedAt: null });
    if (!note) {
      return sendError(res, 'Note not found', 404);
    }

    // Only author or admin can delete
    const isAuthor = note.authorId.toString() === req.user?._id?.toString();
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    if (!isAuthor && !isAdmin) {
      return sendError(res, 'Not authorized to delete this note', 403);
    }

    note.deletedAt = new Date();
    await note.save();

    return sendSuccess(res, null, 'Note deleted');
  } catch (error: any) {
    logger.error('Error in deleteNote:', error);
    return sendError(res, error.message || 'Error deleting note', 500);
  }
};

/**
 * @desc    Get activity timeline for an application
 * @route   GET /api/v1/applications/:id/timeline
 */
export const getTimeline = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = clampPagination(req.query);

    const query = { applicationId: id };
    const total = await ActivityEvent.countDocuments(query);
    const events = await ActivityEvent.find(query)
      .sort({ createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit)
      .lean();

    return sendPaginatedResponse(res, events, total, +page, +limit);
  } catch (error: any) {
    logger.error('Error in getTimeline:', error);
    return sendError(res, error.message || 'Error fetching timeline', 500);
  }
};
