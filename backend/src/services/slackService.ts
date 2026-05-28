/**
 * Slack notification service — Incoming Webhook.
 * Non-blocking: failures log a warning but never throw.
 *
 * Required env var:
 *   SLACK_WEBHOOK_URL — the full Incoming Webhook URL from your Slack app
 *   SLACK_ENABLED     — set to "true" to activate (defaults off)
 */
import axios from 'axios';
import { config } from '../config';
import logger from '../utils/logger';

export const sendSlackMessage = async (
  text: string,
  blocks?: object[]
): Promise<void> => {
  const webhookUrl = (config as any).slack?.webhookUrl;
  if (!(config as any).slack?.enabled || !webhookUrl) return;

  try {
    await axios.post(webhookUrl, { text, blocks }, { timeout: 8_000 });
    logger.info('Slack notification sent');
  } catch (err: any) {
    logger.warn(`Slack send failed: ${err.response?.data || err.message}`);
  }
};

// ── Typed helpers for common events ──────────────────────────────────────────

export const slackNewApplication = async (candidateName: string, jobTitle: string, company: string) => {
  await sendSlackMessage(
    `*New Application* — ${candidateName} applied for *${jobTitle}* at ${company}`
  );
};

export const slackInterviewScheduled = async (candidateName: string, jobTitle: string, dateStr: string) => {
  await sendSlackMessage(
    `*Interview Scheduled* — ${candidateName} for *${jobTitle}* on ${dateStr}`
  );
};

export const slackOfferAccepted = async (candidateName: string, jobTitle: string) => {
  await sendSlackMessage(
    `*Offer Accepted* — ${candidateName} accepted the offer for *${jobTitle}* :tada:`
  );
};
