/**
 * SMS notification service — Twilio REST API via axios.
 * Non-blocking: a send failure logs a warning but never throws to the caller.
 *
 * Required env vars:
 *   SMS_API_KEY      — Twilio Account SID
 *   SMS_AUTH_TOKEN   — Twilio Auth Token
 *   SMS_SENDER_ID    — Twilio phone number or sender ID (E.164 or alphanumeric)
 *   SMS_ENABLED      — set to "true" to activate (defaults off)
 */
import axios from 'axios';
import { config } from '../config';
import logger from '../utils/logger';

export const sendSms = async (to: string | undefined, message: string): Promise<void> => {
  if (!(config.sms as any).enabled) return;
  if (!to) return;

  const accountSid = config.sms.apiKey;
  const authToken  = (config.sms as any).authToken as string | undefined;
  const from       = config.sms.senderId;

  if (!accountSid || !authToken) {
    logger.debug('SMS skipped — SMS_API_KEY or SMS_AUTH_TOKEN not configured');
    return;
  }

  try {
    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      new URLSearchParams({ To: to, From: from, Body: message }).toString(),
      {
        auth:    { username: accountSid, password: authToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10_000,
      }
    );
    logger.info(`SMS sent to ${to}`);
  } catch (err: any) {
    logger.warn(`SMS send failed to ${to}: ${err.response?.data?.message || err.message}`);
  }
};
