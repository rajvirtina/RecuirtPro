import { Response } from 'express';
import { AuthRequest, NotificationType } from '../types';
import { sendSuccess, sendError, sendPaginatedResponse, clampPagination } from '../utils/response';
import { Notification } from '../models';
import logger from '../utils/logger';

/**
 * @desc    Get notifications for current user
 * @route   GET /api/v1/notifications
 * @access  Private
 */
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const { page = 1, limit = 20, read } = req.query;
    const { pageNum, limitNum } = clampPagination(page, limit);

    const query: any = { userId: req.user!._id };
    if (read === 'true') query.read = true;
    if (read === 'false') query.read = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId: req.user!._id, read: false }),
    ]);

    return sendSuccess(res, {
      notifications,
      unreadCount,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    }, 'Notifications retrieved');
  } catch (error: any) {
    logger.error('Error in getNotifications:', error);
    return sendError(res, error.message || 'Failed to get notifications', 500);
  }
};

/**
 * @desc    Mark notification as read
 * @route   PUT /api/v1/notifications/:id/read
 * @access  Private
 */
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!._id },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) return sendError(res, 'Notification not found', 404);
    return sendSuccess(res, notification, 'Notification marked as read');
  } catch (error: any) {
    logger.error('Error in markAsRead:', error);
    return sendError(res, error.message || 'Failed to mark as read', 500);
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/v1/notifications/read-all
 * @access  Private
 */
export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    await Notification.updateMany(
      { userId: req.user!._id, read: false },
      { read: true, readAt: new Date() }
    );

    return sendSuccess(res, null, 'All notifications marked as read');
  } catch (error: any) {
    logger.error('Error in markAllAsRead:', error);
    return sendError(res, error.message || 'Failed to mark all as read', 500);
  }
};

/**
 * @desc    Get unread notification count
 * @route   GET /api/v1/notifications/unread-count
 * @access  Private
 */
export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const count = await Notification.countDocuments({ userId: req.user!._id, read: false });
    return sendSuccess(res, { unreadCount: count }, 'Unread count retrieved');
  } catch (error: any) {
    logger.error('Error in getUnreadCount:', error);
    return sendError(res, error.message || 'Failed to get count', 500);
  }
};

/**
 * @desc    Delete a notification
 * @route   DELETE /api/v1/notifications/:id
 * @access  Private
 */
export const deleteNotification = async (req: AuthRequest, res: Response): Promise<void | Response> => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user!._id,
    });

    if (!notification) return sendError(res, 'Notification not found', 404);
    return sendSuccess(res, null, 'Notification deleted');
  } catch (error: any) {
    logger.error('Error in deleteNotification:', error);
    return sendError(res, error.message || 'Failed to delete notification', 500);
  }
};
