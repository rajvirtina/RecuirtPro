import { Response } from 'express';
import { AuthRequest } from '../types';
/**
 * @desc    Initiate OAuth flow for calendar integration
 * @route   GET /api/v1/calendar/auth/:provider
 * @access  Private
 */
export declare const initiateOAuth: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Handle OAuth callback
 * @route   GET /api/v1/calendar/callback/:provider
 * @access  Public (OAuth callback)
 */
export declare const handleOAuthCallback: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Get user's calendar integrations
 * @route   GET /api/v1/calendar/integrations
 * @access  Private
 */
export declare const getIntegrations: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Delete calendar integration
 * @route   DELETE /api/v1/calendar/integrations/:id
 * @access  Private
 */
export declare const deleteIntegration: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Create calendar event for interview
 * @route   POST /api/v1/calendar/event/:interviewId
 * @access  Private
 */
export declare const createCalendarEvent: (req: AuthRequest, res: Response) => Promise<void | Response>;
//# sourceMappingURL=calendarController.d.ts.map