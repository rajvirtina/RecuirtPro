"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTimeline = exports.deleteNote = exports.createNote = exports.getNotes = void 0;
const Note_1 = require("../models/Note");
const ActivityEvent_1 = require("../models/ActivityEvent");
const models_1 = require("../models");
const types_1 = require("../types");
const response_1 = require("../utils/response");
const logger_1 = __importDefault(require("../utils/logger"));
const auth_1 = require("../middleware/auth");
/**
 * @desc    Get notes for an application
 * @route   GET /api/v1/applications/:id/notes
 */
const getNotes = async (req, res) => {
    try {
        const { id } = req.params;
        const { pageNum, limitNum } = (0, response_1.clampPagination)(req.query.page, req.query.limit);
        const filter = { applicationId: id, deletedAt: null };
        const total = await Note_1.Note.countDocuments(filter);
        const notes = await Note_1.Note.find(filter)
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean();
        return (0, response_1.sendPaginatedResponse)(res, notes, pageNum, limitNum, total);
    }
    catch (error) {
        logger_1.default.error('Error in getNotes:', error);
        return (0, response_1.sendError)(res, error.message || 'Error fetching notes', 500);
    }
};
exports.getNotes = getNotes;
/**
 * @desc    Create a note for an application
 * @route   POST /api/v1/applications/:id/notes
 */
const createNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { content, mentions } = req.body;
        if (!content || content.trim().length === 0) {
            return (0, response_1.sendError)(res, 'Note content is required', 400);
        }
        if (content.length > 2000) {
            return (0, response_1.sendError)(res, 'Note content cannot exceed 2000 characters', 400);
        }
        // Verify application exists and user has access
        const companyId = (0, auth_1.getTenantCompanyId)(req.user);
        const application = await models_1.Application.findOne({ _id: id, ...(companyId ? { companyId } : {}) });
        if (!application) {
            return (0, response_1.sendError)(res, 'Application not found', 404);
        }
        const authorName = `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || 'Unknown';
        const note = await Note_1.Note.create({
            applicationId: id,
            authorId: req.user?._id,
            authorName,
            content: content.trim(),
            mentions: mentions || [],
        });
        // Auto-log activity event
        await ActivityEvent_1.ActivityEvent.create({
            applicationId: id,
            actorId: req.user?._id,
            actorName: authorName,
            type: 'note_added',
            metadata: { noteId: note._id },
        });
        return (0, response_1.sendSuccess)(res, note, 'Note created successfully', 201);
    }
    catch (error) {
        logger_1.default.error('Error in createNote:', error);
        return (0, response_1.sendError)(res, error.message || 'Error creating note', 500);
    }
};
exports.createNote = createNote;
/**
 * @desc    Soft delete a note (author or admin only)
 * @route   DELETE /api/v1/applications/:id/notes/:noteId
 */
const deleteNote = async (req, res) => {
    try {
        const { noteId } = req.params;
        const note = await Note_1.Note.findOne({ _id: noteId, deletedAt: null });
        if (!note) {
            return (0, response_1.sendError)(res, 'Note not found', 404);
        }
        // Only author or admin can delete
        const isAuthor = note.authorId.toString() === req.user?._id?.toString();
        const isAdmin = req.user?.role === types_1.UserRole.ADMIN;
        if (!isAuthor && !isAdmin) {
            return (0, response_1.sendError)(res, 'Not authorized to delete this note', 403);
        }
        note.deletedAt = new Date();
        await note.save();
        return (0, response_1.sendSuccess)(res, null, 'Note deleted');
    }
    catch (error) {
        logger_1.default.error('Error in deleteNote:', error);
        return (0, response_1.sendError)(res, error.message || 'Error deleting note', 500);
    }
};
exports.deleteNote = deleteNote;
/**
 * @desc    Get activity timeline for an application
 * @route   GET /api/v1/applications/:id/timeline
 */
const getTimeline = async (req, res) => {
    try {
        const { id } = req.params;
        const { pageNum, limitNum } = (0, response_1.clampPagination)(req.query.page, req.query.limit);
        const filter = { applicationId: id };
        const total = await ActivityEvent_1.ActivityEvent.countDocuments(filter);
        const events = await ActivityEvent_1.ActivityEvent.find(filter)
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean();
        return (0, response_1.sendPaginatedResponse)(res, events, pageNum, limitNum, total);
    }
    catch (error) {
        logger_1.default.error('Error in getTimeline:', error);
        return (0, response_1.sendError)(res, error.message || 'Error fetching timeline', 500);
    }
};
exports.getTimeline = getTimeline;
//# sourceMappingURL=noteController.js.map