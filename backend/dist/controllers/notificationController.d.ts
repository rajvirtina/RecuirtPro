import { Response } from 'express';
import { AuthRequest } from '../types';
/**
 * @desc    Get notifications for current user
 * @route   GET /api/v1/notifications
 * @access  Private
 */
export declare const getNotifications: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Mark notification as read
 * @route   PUT /api/v1/notifications/:id/read
 * @access  Private
 */
export declare const markAsRead: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/v1/notifications/read-all
 * @access  Private
 */
export declare const markAllAsRead: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Get unread notification count
 * @route   GET /api/v1/notifications/unread-count
 * @access  Private
 */
export declare const getUnreadCount: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Delete a notification
 * @route   DELETE /api/v1/notifications/:id
 * @access  Private
 */
export declare const deleteNotification: (req: AuthRequest, res: Response) => Promise<void | Response>;
//# sourceMappingURL=notificationController.d.ts.map