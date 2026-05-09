import { Response } from 'express';
import { CalendarIntegration, Interview } from '../models';
import { AuthRequest, CalendarProvider } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import logger from '../utils/logger';
import axios from 'axios';
import config from '../config';
import { decrypt } from '../utils/encryption';

/**
 * @desc    Initiate OAuth flow for calendar integration
 * @route   GET /api/v1/calendar/auth/:provider
 * @access  Private
 */
export const initiateOAuth = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { provider } = req.params;

    const redirectUri = `${config.server.url}/api/v1/calendar/callback/${provider}`;
    const state = Buffer.from(
      JSON.stringify({ userId: req.user?._id, provider })
    ).toString('base64');

    let authUrl = '';

    switch (provider) {
      case CalendarProvider.GOOGLE:
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${config.google.clientId}&` +
          `redirect_uri=${redirectUri}&` +
          `response_type=code&` +
          `scope=https://www.googleapis.com/auth/calendar&` +
          `access_type=offline&` +
          `prompt=consent&` +
          `state=${state}`;
        break;

      case CalendarProvider.MICROSOFT:
        authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
          `client_id=${config.microsoft.clientId}&` +
          `redirect_uri=${redirectUri}&` +
          `response_type=code&` +
          `scope=https://graph.microsoft.com/Calendars.ReadWrite offline_access&` +
          `state=${state}`;
        break;

      case CalendarProvider.ZOHO:
        authUrl = `https://accounts.zoho.com/oauth/v2/auth?` +
          `client_id=${config.zoho.clientId}&` +
          `redirect_uri=${redirectUri}&` +
          `response_type=code&` +
          `scope=ZohoCalendar.calendar.ALL&` +
          `access_type=offline&` +
          `state=${state}`;
        break;

      default:
        return sendError(res, 'Unsupported calendar provider', 400);
    }

    return sendSuccess(res, { authUrl }, 'OAuth URL generated');
  } catch (error: any) {
    logger.error('Error in initiateOAuth:', error);
    return sendError(res, error.message || 'Error initiating OAuth', 500);
  }
};

/**
 * @desc    Handle OAuth callback
 * @route   GET /api/v1/calendar/callback/:provider
 * @access  Public (OAuth callback)
 */
export const handleOAuthCallback = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { provider } = req.params;
    const { code, state } = req.query;

    if (!code || !state) {
      return sendError(res, 'Invalid OAuth callback', 400);
    }

    const { userId } = JSON.parse(
      Buffer.from(state as string, 'base64').toString()
    );

    const redirectUri = `${config.server.url}/api/v1/calendar/callback/${provider}`;

    let tokenData: any;

    switch (provider) {
      case CalendarProvider.GOOGLE:
        tokenData = await exchangeGoogleToken(code as string, redirectUri);
        break;

      case CalendarProvider.MICROSOFT:
        tokenData = await exchangeMicrosoftToken(code as string, redirectUri);
        break;

      case CalendarProvider.ZOHO:
        tokenData = await exchangeZohoToken(code as string, redirectUri);
        break;

      default:
        return sendError(res, 'Unsupported calendar provider', 400);
    }

    // Deactivate existing integration for this provider
    await CalendarIntegration.updateMany(
      { userId, provider, isActive: true },
      { isActive: false }
    );

    // Create new calendar integration
    await CalendarIntegration.create({
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

    logger.info(`Calendar integration added for user ${userId} - Provider: ${provider}`);

    // Redirect to frontend success page
    return res.redirect(`${config.frontend.url}/settings/calendar?success=true&provider=${provider}`);
  } catch (error: any) {
    logger.error('Error in handleOAuthCallback:', error);
    return res.redirect(`${config.frontend.url}/settings/calendar?error=true`);
  }
};

/**
 * @desc    Get user's calendar integrations
 * @route   GET /api/v1/calendar/integrations
 * @access  Private
 */
export const getIntegrations = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const integrations = await CalendarIntegration.find({
      userId: req.user?._id,
      isActive: true,
    }).select('-accessToken -refreshToken');

    return sendSuccess(res, integrations, 'Integrations retrieved successfully');
  } catch (error: any) {
    logger.error('Error in getIntegrations:', error);
    return sendError(res, error.message || 'Error fetching integrations', 500);
  }
};

/**
 * @desc    Delete calendar integration
 * @route   DELETE /api/v1/calendar/integrations/:id
 * @access  Private
 */
export const deleteIntegration = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { id } = req.params;

    const integration = await CalendarIntegration.findOne({
      _id: id,
      userId: req.user?._id,
    });

    if (!integration) {
      return sendError(res, 'Integration not found', 404);
    }

    integration.isActive = false;
    await integration.save();

    logger.info(`Calendar integration ${id} deactivated`);

    return sendSuccess(res, null, 'Integration deleted successfully');
  } catch (error: any) {
    logger.error('Error in deleteIntegration:', error);
    return sendError(res, error.message || 'Error deleting integration', 500);
  }
};

/**
 * @desc    Create calendar event for interview
 * @route   POST /api/v1/calendar/event/:interviewId
 * @access  Private
 */
export const createCalendarEvent = async (
  req: AuthRequest,
  res: Response
): Promise<void | Response> => {
  try {
    const { interviewId } = req.params;
    const { provider } = req.body;

    const interview = await Interview.findById(interviewId)
      .populate('jobId', 'title')
      .populate('candidateId', 'firstName lastName email');

    if (!interview) {
      return sendError(res, 'Interview not found', 404);
    }

    // Check authorization
    const isAuthorized =
      req.user?.role === 'admin' ||
      ((req.user?.role === 'employer' || req.user?.role === 'hr') &&
        interview.companyId?.toString() === req.user?.companyId);

    if (!isAuthorized) {
      return sendError(res, 'Not authorized', 403);
    }

    // Get calendar integration
    const integration = await CalendarIntegration.findOne({
      userId: req.user._id,
      provider: provider || CalendarProvider.GOOGLE,
      isActive: true,
    });

    if (!integration) {
      return sendError(res, 'Calendar integration not found. Please connect your calendar first.', 404);
    }

    // Check token expiry and refresh if needed
    if (integration.expiresAt && integration.expiresAt < new Date()) {
      await refreshAccessToken(integration);
    }

    // Create event based on provider
    let eventId: string;

    switch (integration.provider) {
      case CalendarProvider.GOOGLE:
        eventId = await createGoogleCalendarEvent(interview, integration);
        break;

      case CalendarProvider.MICROSOFT:
        eventId = await createMicrosoftCalendarEvent(interview, integration);
        break;

      case CalendarProvider.ZOHO:
        eventId = await createZohoCalendarEvent(interview, integration);
        break;

      default:
        return sendError(res, 'Unsupported calendar provider', 400);
    }

    // Update interview with calendar info
    interview.calendarEventId = eventId;
    interview.calendarProvider = integration.provider;
    await interview.save();

    logger.info(`Calendar event created for interview ${interviewId}`);

    return sendSuccess(res, { eventId }, 'Calendar event created successfully');
  } catch (error: any) {
    logger.error('Error in createCalendarEvent:', error);
    return sendError(res, error.message || 'Error creating calendar event', 500);
  }
};

// ============= Helper Functions =============

async function exchangeGoogleToken(code: string, redirectUri: string) {
  const response = await axios.post('https://oauth2.googleapis.com/token', {
    code,
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  // Get user email
  const userInfo = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${response.data.access_token}` },
  });

  return { ...response.data, email: userInfo.data.email };
}

async function exchangeMicrosoftToken(code: string, redirectUri: string) {
  const response = await axios.post(
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    new URLSearchParams({
      code,
      client_id: config.microsoft.clientId!,
      client_secret: config.microsoft.clientSecret!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  // Get user email from token
  const userInfo = await axios.get('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${response.data.access_token}` },
  });

  return { ...response.data, email: userInfo.data.mail || userInfo.data.userPrincipalName };
}

async function exchangeZohoToken(code: string, redirectUri: string) {
  const response = await axios.post(
    'https://accounts.zoho.com/oauth/v2/token',
    new URLSearchParams({
      code,
      client_id: config.zoho.clientId!,
      client_secret: config.zoho.clientSecret!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return response.data;
}

async function refreshAccessToken(integration: any) {
  let newToken: any;

  // SEC-11: Decrypt refresh token before sending to OAuth provider
  const decryptedRefreshToken = integration.getDecryptedRefreshToken?.() || integration.refreshToken;

  switch (integration.provider) {
    case CalendarProvider.GOOGLE:
      newToken = await axios.post('https://oauth2.googleapis.com/token', {
        refresh_token: decryptedRefreshToken,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        grant_type: 'refresh_token',
      });
      break;

    case CalendarProvider.MICROSOFT:
      newToken = await axios.post(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        new URLSearchParams({
          refresh_token: decryptedRefreshToken!,
          client_id: config.microsoft.clientId!,
          client_secret: config.microsoft.clientSecret!,
          grant_type: 'refresh_token',
        })
      );
      break;

    case CalendarProvider.ZOHO:
      newToken = await axios.post(
        'https://accounts.zoho.com/oauth/v2/token',
        new URLSearchParams({
          refresh_token: decryptedRefreshToken!,
          client_id: config.zoho.clientId!,
          client_secret: config.zoho.clientSecret!,
          grant_type: 'refresh_token',
        })
      );
      break;
  }

  if (newToken) {
    integration.accessToken = newToken.data.access_token;
    integration.expiresAt = new Date(Date.now() + newToken.data.expires_in * 1000);
    await integration.save();
  }
}

async function createGoogleCalendarEvent(interview: any, integration: any): Promise<string> {
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
      dateTime: new Date(
        new Date(interview.scheduledTime).getTime() + interview.duration * 60000
      ),
      timeZone: interview.timezone || 'Asia/Kolkata',
    },
    attendees: [
      { email: interview.candidateId.email },
      ...interview.panel.map((p: any) => ({ email: p.email })),
    ],
  };

  const response = await axios.post(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    event,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  return response.data.id;
}

async function createMicrosoftCalendarEvent(interview: any, integration: any): Promise<string> {
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
      dateTime: new Date(
        new Date(interview.scheduledTime).getTime() + interview.duration * 60000
      ),
      timeZone: interview.timezone || 'Asia/Kolkata',
    },
    attendees: [
      {
        emailAddress: { address: interview.candidateId.email },
        type: 'required',
      },
      ...interview.panel.map((p: any) => ({
        emailAddress: { address: p.email },
        type: 'optional',
      })),
    ],
  };

  const response = await axios.post(
    'https://graph.microsoft.com/v1.0/me/events',
    event,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  return response.data.id;
}

async function createZohoCalendarEvent(interview: any, integration: any): Promise<string> {
  // SEC-11: Decrypt access token for API call
  const accessToken = integration.getDecryptedAccessToken?.() || integration.accessToken;
  const event = {
    title: `Interview - ${interview.jobId.title}`,
    description: `Interview with ${interview.candidateId.firstName} ${interview.candidateId.lastName}\nMeeting Link: ${interview.meetingLink || 'TBD'}`,
    stime: new Date(interview.scheduledTime).getTime(),
    etime: new Date(
      new Date(interview.scheduledTime).getTime() + interview.duration * 60000
    ).getTime(),
    attendees: [
      interview.candidateId.email,
      ...interview.panel.map((p: any) => p.email),
    ].join(','),
  };

  const response = await axios.post(
    'https://calendar.zoho.com/api/v1/calendars/primary/events',
    event,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  return response.data.events[0].uid;
}
