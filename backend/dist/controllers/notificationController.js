"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNotification = exports.getUnreadCount = exports.markAllAsRead = exports.markAsRead = exports.getNotifications = void 0;
const response_1 = require("../utils/response");
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * @desc    Get notifications for current user
 * @route   GET /api/v1/notifications
 * @access  Private
 */
const getNotifications = async (req, res) => {
    try {
        const { page = 1, limit = 20, read } = req.query;
        const { pageNum, limitNum } = (0, response_1.clampPagination)(page, limit);
        const query = { userId: req.user._id };
        if (read === 'true')
            query.read = true;
        if (read === 'false')
            query.read = false;
        const [notifications, total, unreadCount] = await Promise.all([
            models_1.Notification.find(query)
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum),
            models_1.Notification.countDocuments(query),
            models_1.Notification.countDocuments({ userId: req.user._id, read: false }),
        ]);
        return (0, response_1.sendSuccess)(res, {
            notifications,
            unreadCount,
            pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
        }, 'Notifications retrieved');
    }
    catch (error) {
        logger_1.default.error('Error in getNotifications:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to get notifications', 500);
    }
};
exports.getNotifications = getNotifications;
/**
 * @desc    Mark notification as read
 * @route   PUT /api/v1/notifications/:id/read
 * @access  Private
 */
const markAsRead = async (req, res) => {
    try {
        const notification = await models_1.Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { read: true, readAt: new Date() }, { new: true });
        if (!notification)
            return (0, response_1.sendError)(res, 'Notification not found', 404);
        return (0, response_1.sendSuccess)(res, notification, 'Notification marked as read');
    }
    catch (error) {
        logger_1.default.error('Error in markAsRead:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to mark as read', 500);
    }
};
exports.markAsRead = markAsRead;
/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/v1/notifications/read-all
 * @access  Private
 */
const markAllAsRead = async (req, res) => {
    try {
        await models_1.Notification.updateMany({ userId: req.user._id, read: false }, { read: true, readAt: new Date() });
        return (0, response_1.sendSuccess)(res, null, 'All notifications marked as read');
    }
    catch (error) {
        logger_1.default.error('Error in markAllAsRead:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to mark all as read', 500);
    }
};
exports.markAllAsRead = markAllAsRead;
/**
 * @desc    Get unread notification count
 * @route   GET /api/v1/notifications/unread-count
 * @access  Private
 */
const getUnreadCount = async (req, res) => {
    try {
        const count = await models_1.Notification.countDocuments({ userId: req.user._id, read: false });
        return (0, response_1.sendSuccess)(res, { unreadCount: count }, 'Unread count retrieved');
    }
    catch (error) {
        logger_1.default.error('Error in getUnreadCount:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to get count', 500);
    }
};
exports.getUnreadCount = getUnreadCount;
/**
 * @desc    Delete a notification
 * @route   DELETE /api/v1/notifications/:id
 * @access  Private
 */
const deleteNotification = async (req, res) => {
    try {
        const notification = await models_1.Notification.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id,
        });
        if (!notification)
            return (0, response_1.sendError)(res, 'Notification not found', 404);
        return (0, response_1.sendSuccess)(res, null, 'Notification deleted');
    }
    catch (error) {
        logger_1.default.error('Error in deleteNotification:', error);
        return (0, response_1.sendError)(res, error.message || 'Failed to delete notification', 500);
    }
};
exports.deleteNotification = deleteNotification;
//# sourceMappingURL=notificationController.js.map