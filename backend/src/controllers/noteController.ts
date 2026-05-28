import { Response } from 'express';
import { Note } from '../models/Note';
import { ActivityEvent } from '../models/ActivityEvent';
import { Application, User } from '../models';
import { AuthRequest, UserRole } from '../types';
import { sendSuccess, sendError, sendPaginatedResponse, clampPagination } from '../utils/response';
import logger from '../utils/logger';
import { getTenantCompanyId } from '../middleware/auth';
import { notificationService } from '../services/notificationService';

/**
 * @desc    Get notes for an application
 * @route   GET /api/v1/applications/:id/notes
 */
export const getNotes = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { pageNum, limitNum } = clampPagination(req.query.page, req.query.limit);

    const filter = { applicationId: id, deletedAt: null };
    const total = await Note.countDocuments(filter);
    const notes = await Note.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    return sendPaginatedResponse(res, notes, pageNum, limitNum, total);
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
    const companyId = getTenantCompanyId(req.user);
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

    // Fire @mention notifications for any mentioned users
    if (mentions && mentions.length > 0 && companyId) {
      try {
        const mentionedUsers = await User.find({
          _id: { $in: mentions },
          companyId,
          deletedAt: null,
        }).select('_id').lean();

        if (mentionedUsers.length > 0) {
          const preview = content.length > 80 ? `${content.slice(0, 80)}…` : content;
          await notificationService.createBulkNotifications(
            mentionedUsers.map((u: any) => u._id.toString()),
            {
              type: 'in_app' as any,
              title: `${authorName} mentioned you`,
              message: `You were mentioned in a note on application #${id.slice(-6).toUpperCase()}: "${preview}"`,
              priority: 'medium',
              data: { applicationId: id, noteId: (note as any)._id.toString(), type: 'mention' },
            }
          );
        }
      } catch (mentionErr: any) {
        logger.warn('[createNote] @mention notification failed (non-fatal):', mentionErr.message);
      }
    }

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
    const isAdmin = req.user?.role === UserRole.ADMIN;
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
    const { pageNum, limitNum } = clampPagination(req.query.page, req.query.limit);

    const filter = { applicationId: id };
    const total = await ActivityEvent.countDocuments(filter);
    const events = await ActivityEvent.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    return sendPaginatedResponse(res, events, pageNum, limitNum, total);
  } catch (error: any) {
    logger.error('Error in getTimeline:', error);
    return sendError(res, error.message || 'Error fetching timeline', 500);
  }
};
