"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCalendarEvent = exports.deleteIntegration = exports.getIntegrations = exports.handleOAuthCallback = exports.initiateOAuth = void 0;
const models_1 = require("../models");
const types_1 = require("../types");
const response_1 = require("../utils/response");
const logger_1 = __importDefault(require("../utils/logger"));
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../config"));
const auth_1 = require("../middleware/auth");
/**
 * @desc    Initiate OAuth flow for calendar integration
 * @route   GET /api/v1/calendar/auth/:provider
 * @access  Private
 */
const initiateOAuth = async (req, res) => {
    try {
        const { provider } = req.params;
        const redirectUri = `${config_1.default.server.url}/api/v1/calendar/callback/${provider}`;
        const state = Buffer.from(JSON.stringify({ userId: req.user?._id, provider })).toString('base64');
        let authUrl = '';
        switch (provider) {
            case types_1.CalendarProvider.GOOGLE:
                authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                    `client_id=${config_1.default.google.clientId}&` +
                    `redirect_uri=${redirectUri}&` +
                    `response_type=code&` +
                    `scope=https://www.googleapis.com/auth/calendar&` +
                    `access_type=offline&` +
                    `prompt=consent&` +
                    `state=${state}`;
                break;
            case types_1.CalendarProvider.MICROSOFT:
                authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
                    `client_id=${config_1.default.microsoft.clientId}&` +
                    `redirect_uri=${redirectUri}&` +
                    `response_type=code&` +
                    `scope=https://graph.microsoft.com/Calendars.ReadWrite offline_access&` +
                    `state=${state}`;
                break;
            case types_1.CalendarProvider.ZOHO:
                authUrl = `https://accounts.zoho.com/oauth/v2/auth?` +
                    `client_id=${config_1.default.zoho.clientId}&` +
                    `redirect_uri=${redirectUri}&` +
                    `response_type=code&` +
                    `scope=ZohoCalendar.calendar.ALL&` +
                    `access_type=offline&` +
                    `state=${state}`;
                break;
            default:
                return (0, response_1.sendError)(res, 'Unsupported calendar provider', 400);
        }
        return (0, response_1.sendSuccess)(res, { authUrl }, 'OAuth URL generated');
    }
    catch (error) {
        logger_1.default.error('Error in initiateOAuth:', error);
        return (0, response_1.sendError)(res, error.message || 'Error initiating OAuth', 500);
    }
};
exports.initiateOAuth = initiateOAuth;
/**
 * @desc    Handle OAuth callback
 * @route   GET /api/v1/calendar/callback/:provider
 * @access  Public (OAuth callback)
 */
const handleOAuthCallback = async (req, res) => {
    try {
        const { provider } = req.params;
        const { code, state } = req.query;
        if (!code || !state) {
            return (0, response_1.sendError)(res, 'Invalid OAuth callback', 400);
        }
        const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());
        const redirectUri = `${config_1.default.server.url}/api/v1/calendar/callback/${provider}`;
        let tokenData;
        switch (provider) {
            case types_1.CalendarProvider.GOOGLE:
                tokenData = await exchangeGoogleToken(code, redirectUri);
                break;
            case types_1.CalendarProvider.MICROSOFT:
                tokenData = await exchangeMicrosoftToken(code, redirectUri);
                break;
            case types_1.CalendarProvider.ZOHO:
                tokenData = await exchangeZohoToken(code, redirectUri);
                break;
            default:
                return (0, response_1.sendError)(res, 'Unsupported calendar provider', 400);
        }
        // Deactivate existing integration for this provider
        await models_1.CalendarIntegration.updateMany({ userId, provider, isActive: true }, { isActive: false });
        // Create new calendar integration
        await models_1.CalendarIntegration.create({
            userId,
            provider,
            email: tokenData.email,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: tokenData.expires_in
                ? new Date(Date.now() + tokenData.expires_in * 1000)
                : undefined,
            scope: tokenData.scope ? tokenData.scope.split(' ').join(' ') : '',
            isActive: true,
        });
        logger_1.default.info(`Calendar integration added for user ${userId} - Provider: ${provider}`);
        // Redirect to frontend success page
        return res.redirect(`${config_1.default.frontend.url}/settings/calendar?success=true&provider=${provider}`);
    }
    catch (error) {
        logger_1.default.error('Error in handleOAuthCallback:', error);
        return res.redirect(`${config_1.default.frontend.url}/settings/calendar?error=true`);
    }
};
exports.handleOAuthCallback = handleOAuthCallback;
/**
 * @desc    Get user's calendar integrations
 * @route   GET /api/v1/calendar/integrations
 * @access  Private
 */
const getIntegrations = async (req, res) => {
    try {
        const integrations = await models_1.CalendarIntegration.find({
            userId: req.user?._id,
            isActive: true,
        }).select('-accessToken -refreshToken');
        return (0, response_1.sendSuccess)(res, integrations, 'Integrations retrieved successfully');
    }
    catch (error) {
        logger_1.default.error('Error in getIntegrations:', error);
        return (0, response_1.sendError)(res, error.message || 'Error fetching integrations', 500);
    }
};
exports.getIntegrations = getIntegrations;
/**
 * @desc    Delete calendar integration
 * @route   DELETE /api/v1/calendar/integrations/:id
 * @access  Private
 */
const deleteIntegration = async (req, res) => {
    try {
        const { id } = req.params;
        const integration = await models_1.CalendarIntegration.findOne({
            _id: id,
            userId: req.user?._id,
        });
        if (!integration) {
            return (0, response_1.sendError)(res, 'Integration not found', 404);
        }
        integration.isActive = false;
        await integration.save();
        logger_1.default.info(`Calendar integration ${id} deactivated`);
        return (0, response_1.sendSuccess)(res, null, 'Integration deleted successfully');
    }
    catch (error) {
        logger_1.default.error('Error in deleteIntegration:', error);
        return (0, response_1.sendError)(res, error.message || 'Error deleting integration', 500);
    }
};
exports.deleteIntegration = deleteIntegration;
/**
 * @desc    Create calendar event for interview
 * @route   POST /api/v1/calendar/event/:interviewId
 * @access  Private
 */
const createCalendarEvent = async (req, res) => {
    try {
        const { interviewId } = req.params;
        const { provider } = req.body;
        const interview = await models_1.Interview.findById(interviewId)
            .populate('jobId', 'title')
            .populate('candidateId', 'firstName lastName email');
        if (!interview) {
            return (0, response_1.sendError)(res, 'Interview not found', 404);
        }
        // Check authorization — TENANT ISOLATION
        const tenantId = (0, auth_1.getTenantCompanyId)(req.user);
        const isAuthorized = (0, auth_1.isSuperAdmin)(req.user) ||
            (tenantId && interview.companyId?.toString() === tenantId);
        if (!isAuthorized) {
            return (0, response_1.sendError)(res, 'Not authorized', 403);
        }
        // Get calendar integration
        const integration = await models_1.CalendarIntegration.findOne({
            userId: req.user._id,
            provider: provider || types_1.CalendarProvider.GOOGLE,
            isActive: true,
        });
        if (!integration) {
            return (0, response_1.sendError)(res, 'Calendar integration not found. Please connect your calendar first.', 404);
        }
        // Check token expiry and refresh if needed
        if (integration.expiresAt && integration.expiresAt < new Date()) {
            await refreshAccessToken(integration);
        }
        // Create event based on provider
        let eventId;
        switch (integration.provider) {
            case types_1.CalendarProvider.GOOGLE:
                eventId = await createGoogleCalendarEvent(interview, integration);
                break;
            case types_1.CalendarProvider.MICROSOFT:
                eventId = await createMicrosoftCalendarEvent(interview, integration);
                break;
            case types_1.CalendarProvider.ZOHO:
                eventId = await createZohoCalendarEvent(interview, integration);
                break;
            default:
                return (0, response_1.sendError)(res, 'Unsupported calendar provider', 400);
        }
        // Update interview with calendar info
        interview.calendarEventId = eventId;
        interview.calendarProvider = integration.provider;
        await interview.save();
        logger_1.default.info(`Calendar event created for interview ${interviewId}`);
        return (0, response_1.sendSuccess)(res, { eventId }, 'Calendar event created successfully');
    }
    catch (error) {
        logger_1.default.error('Error in createCalendarEvent:', error);
        return (0, response_1.sendError)(res, error.message || 'Error creating calendar event', 500);
    }
};
exports.createCalendarEvent = createCalendarEvent;
// ============= Helper Functions =============
async function exchangeGoogleToken(code, redirectUri) {
    const response = await axios_1.default.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: config_1.default.google.clientId,
        client_secret: config_1.default.google.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
    });
    // Get user email
    const userInfo = await axios_1.default.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${response.data.access_token}` },
    });
    return { ...response.data, email: userInfo.data.email };
}
async function exchangeMicrosoftToken(code, redirectUri) {
    const response = await axios_1.default.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', new URLSearchParams({
        code,
        client_id: config_1.default.microsoft.clientId,
        client_secret: config_1.default.microsoft.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    // Get user email from token
    const userInfo = await axios_1.default.get('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${response.data.access_token}` },
    });
    return { ...response.data, email: userInfo.data.mail || userInfo.data.userPrincipalName };
}
async function exchangeZohoToken(code, redirectUri) {
    const response = await axios_1.default.post('https://accounts.zoho.com/oauth/v2/token', new URLSearchParams({
        code,
        client_id: config_1.default.zoho.clientId,
        client_secret: config_1.default.zoho.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    return response.data;
}
async function refreshAccessToken(integration) {
    let newToken;
    // SEC-11: Decrypt refresh token before sending to OAuth provider
    const decryptedRefreshToken = integration.getDecryptedRefreshToken?.() || integration.refreshToken;
    switch (integration.provider) {
        case types_1.CalendarProvider.GOOGLE:
            newToken = await axios_1.default.post('https://oauth2.googleapis.com/token', {
                refresh_token: decryptedRefreshToken,
                client_id: config_1.default.google.clientId,
                client_secret: config_1.default.google.clientSecret,
                grant_type: 'refresh_token',
            });
            break;
        case types_1.CalendarProvider.MICROSOFT:
            newToken = await axios_1.default.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', new URLSearchParams({
                refresh_token: decryptedRefreshToken,
                client_id: config_1.default.microsoft.clientId,
                client_secret: config_1.default.microsoft.clientSecret,
                grant_type: 'refresh_token',
            }));
            break;
        case types_1.CalendarProvider.ZOHO:
            newToken = await axios_1.default.post('https://accounts.zoho.com/oauth/v2/token', new URLSearchParams({
                refresh_token: decryptedRefreshToken,
                client_id: config_1.default.zoho.clientId,
                client_secret: config_1.default.zoho.clientSecret,
                grant_type: 'refresh_token',
            }));
            break;
    }
    if (newToken) {
        integration.accessToken = newToken.data.access_token;
        integration.expiresAt = new Date(Date.now() + newToken.data.expires_in * 1000);
        await integration.save();
    }
}
async function createGoogleCalendarEvent(interview, integration) {
    // SEC-11: Decrypt access token for API call
    const accessToken = integration.getDecryptedAccessToken?.() || integration.accessToken;
    const event = {
        summary: `Interview - ${interview.jobId.title}`,
        description: `Interview with ${interview.candidateId.firstName} ${interview.candidateId.lastName}\nMeeting Link: ${interview.meetingLink || 'TBD'}`,
        start: {
            dateTime: interview.scheduledTime,
            timeZone: interview.timezone || 'Asia/Kolkata',
        },
        end: {
            dateTime: new Date(new Date(interview.scheduledTime).getTime() + interview.duration * 60000),
            timeZone: interview.timezone || 'Asia/Kolkata',
        },
        attendees: [
            { email: interview.candidateId.email },
            ...interview.panel.map((p) => ({ email: p.email })),
        ],
    };
    const response = await axios_1.default.post('https://www.googleapis.com/calendar/v3/calendars/primary/events', event, { headers: { Authorization: `Bearer ${accessToken}` } });
    return response.data.id;
}
async function createMicrosoftCalendarEvent(interview, integration) {
    // SEC-11: Decrypt access token for API call
    const accessToken = integration.getDecryptedAccessToken?.() || integration.accessToken;
    const event = {
        subject: `Interview - ${interview.jobId.title}`,
        body: {
            contentType: 'HTML',
            content: `Interview with ${interview.candidateId.firstName} ${interview.candidateId.lastName}<br>Meeting Link: ${interview.meetingLink || 'TBD'}`,
        },
        start: {
            dateTime: interview.scheduledTime,
            timeZone: interview.timezone || 'Asia/Kolkata',
        },
        end: {
            dateTime: new Date(new Date(interview.scheduledTime).getTime() + interview.duration * 60000),
            timeZone: interview.timezone || 'Asia/Kolkata',
        },
        attendees: [
            {
                emailAddress: { address: interview.candidateId.email },
                type: 'required',
            },
            ...interview.panel.map((p) => ({
                emailAddress: { address: p.email },
                type: 'optional',
            })),
        ],
    };
    const response = await axios_1.default.post('https://graph.microsoft.com/v1.0/me/events', event, { headers: { Authorization: `Bearer ${accessToken}` } });
    return response.data.id;
}
async function createZohoCalendarEvent(interview, integration) {
    // SEC-11: Decrypt access token for API call
    const accessToken = integration.getDecryptedAccessToken?.() || integration.accessToken;
    const event = {
        title: `Interview - ${interview.jobId.title}`,
        description: `Interview with ${interview.candidateId.firstName} ${interview.candidateId.lastName}\nMeeting Link: ${interview.meetingLink || 'TBD'}`,
        stime: new Date(interview.scheduledTime).getTime(),
        etime: new Date(new Date(interview.scheduledTime).getTime() + interview.duration * 60000).getTime(),
        attendees: [
            interview.candidateId.email,
            ...interview.panel.map((p) => p.email),
        ].join(','),
    };
    const response = await axios_1.default.post('https://calendar.zoho.com/api/v1/calendars/primary/events', event, { headers: { Authorization: `Bearer ${accessToken}` } });
    return response.data.events[0].uid;
}
//# sourceMappingURL=calendarController.js.map