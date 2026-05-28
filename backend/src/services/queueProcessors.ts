import Bull from 'bull';
import { config } from '../config';
import logger from '../utils/logger';
import { isEmailQueueUp, closeEmailQueue, sendEmail } from '../services/emailService';
import { sendSms } from './smsService';

// ── Redis connection config ───────────────────────────────────────────────────

function makeRedisConfig() {
  const cfg: any = {
    host:                 config.redis.host,
    port:                 config.redis.port,
    password:             config.redis.password || undefined,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 3) return null; // stop retrying
      return Math.min(times * 1000, 5000);
    },
  };
  if ((config.redis as any).tls) cfg.tls = {};
  return cfg;
}

function isRedisConfigured() {
  const h = config.redis.host;
  return h && h !== 'localhost' && h.trim() !== '';
}

// ── Queue instances ───────────────────────────────────────────────────────────

let crossPortalQueue:      Bull.Queue | null = null;
let offerExpiryQueue:      Bull.Queue | null = null;
let jobExpiryQueue:        Bull.Queue | null = null;
let retentionCleanupQueue: Bull.Queue | null = null;
let reminderQueue:         Bull.Queue | null = null;

function initQueues() {
  if (!isRedisConfigured()) {
    logger.info('[Queues] Redis not configured — all background queues disabled');
    return;
  }

  try {
    const redisConfig = makeRedisConfig();

    // ── Cross-portal job posting ───────────────────────────────────────────
    crossPortalQueue = new Bull('cross-portal-posting', { redis: redisConfig });
    crossPortalQueue.on('error', (err) => logger.error('[CrossPortalQueue] Redis error:', err.message));
    crossPortalQueue.process(async (job) => {
      const { jobId, portals } = job.data as { jobId: string; portals: string[]; jobData: any };
      logger.info(`[CrossPortalQueue] Posting job ${jobId} to: ${portals.join(', ')}`);
      const results: Record<string, { success: boolean; error?: string }> = {};
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { triggerPortalPosting } = require('./jobPortalService') as typeof import('./jobPortalService');
      for (const portal of portals) {
        try {
          const r = await triggerPortalPosting(jobId, portal as 'naukri' | 'linkedin');
          results[portal] = r;
        } catch (err: any) {
          results[portal] = { success: false, error: err.message };
        }
      }
      return results;
    });
    crossPortalQueue.on('failed', (job, err) =>
      logger.error(`[CrossPortalQueue] Job ${job.id} failed:`, err.message)
    );

    // ── Offer expiry — runs every hour ────────────────────────────────────
    offerExpiryQueue = new Bull('offer-expiry', { redis: redisConfig });
    offerExpiryQueue.on('error', (err) => logger.error('[OfferExpiryQueue] Error:', err.message));
    offerExpiryQueue.add({}, { repeat: { cron: '0 * * * *' } });
    offerExpiryQueue.process(async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Offer } = require('../models') as typeof import('../models');
      const result = await (Offer as any).updateMany(
        { status: 'sent', expiresAt: { $lt: new Date() }, deletedAt: null },
        {
          $set: { status: 'expired' },
          $push: {
            statusHistory: {
              status: 'expired',
              changedAt: new Date(),
              remarks: 'Auto-expired by system',
            },
          },
        }
      );
      if (result.modifiedCount > 0) {
        logger.info(`[OfferExpiry] Auto-expired ${result.modifiedCount} offer(s)`);
      }
    });

    // ── Job expiry — runs daily at midnight ───────────────────────────────
    jobExpiryQueue = new Bull('job-expiry', { redis: redisConfig });
    jobExpiryQueue.on('error', (err) => logger.error('[JobExpiryQueue] Error:', err.message));
    jobExpiryQueue.add({}, { repeat: { cron: '0 0 * * *' } });
    jobExpiryQueue.process(async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Job } = require('../models') as typeof import('../models');
      const result = await (Job as any).updateMany(
        { status: 'published', expiryDate: { $lt: new Date() }, deletedAt: null },
        { $set: { status: 'expired' } }
      );
      if (result.modifiedCount > 0) {
        logger.info(`[JobExpiry] Auto-expired ${result.modifiedCount} job(s)`);
      }
    });

    // ── Data retention cleanup — runs nightly at 2 AM ────────────────────
    retentionCleanupQueue = new Bull('data-retention-cleanup', { redis: redisConfig });
    retentionCleanupQueue.on('error', (err) => logger.error('[RetentionQueue] Error:', err.message));
    retentionCleanupQueue.add({}, { repeat: { cron: '0 2 * * *' } });
    retentionCleanupQueue.process(async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Company, Application } = require('../models') as typeof import('../models');

      const companies = await (Company as any).find({
        'settings.autoDeleteRejected': true,
        deletedAt: null,
      }).select('_id settings.dataRetentionMonths').lean();

      for (const company of companies) {
        const months = company.settings?.dataRetentionMonths ?? 12;
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - months);

        const stale = await (Application as any).find({
          companyId: company._id,
          status:    'rejected',
          updatedAt: { $lt: cutoff },
          deletedAt: null,
        }).select('_id candidateId').lean();

        for (const app of stale) {
          await (Application as any).findByIdAndUpdate(app._id, { deletedAt: new Date() });
        }
        if (stale.length > 0) {
          logger.info(`[Retention] Soft-deleted ${stale.length} stale rejected applications for company ${company._id}`);
        }
      }
    });

    // ── Interview reminder — fires 1 hour before scheduled time ─────────
    reminderQueue = new Bull('interview-reminders', { redis: redisConfig });
    reminderQueue.on('error', (err) => logger.error('[ReminderQueue] Error:', err.message));
    reminderQueue.process(async (job) => {
      const { candidatePhone, candidateEmail, candidateName, jobTitle, scheduledTime, meetingLink } = job.data;
      const timeStr = new Date(scheduledTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      void sendSms(
        candidatePhone,
        `Reminder: Your interview for ${jobTitle} starts in 1 hour at ${timeStr}.${meetingLink ? ` Join: ${meetingLink}` : ''}`
      );

      void sendEmail({
        to: candidateEmail,
        subject: `Interview Reminder — ${jobTitle} in 1 hour`,
        template: 'interviewScheduled',
        data: { candidateName, jobTitle, scheduledTime: timeStr, meetingLink: meetingLink || null },
      }).catch(() => {});
    });
    reminderQueue.on('failed', (job, err) =>
      logger.error(`[ReminderQueue] Job ${job.id} failed:`, err.message)
    );

    logger.info('[Queues] All queues initialized successfully');
  } catch (err: any) {
    logger.error('[Queues] Failed to initialize queues:', err.message);
  }
}

initQueues();

// ── Public helpers ────────────────────────────────────────────────────────────

/** Reflects email queue Redis status (email queue is owned by emailService) */
export const isRedisAvailable = () => isEmailQueueUp();

/**
 * Enqueue a 1-hour-before reminder for an interview.
 * Called from interviewController after Interview.create().
 */
export const enqueueInterviewReminder = async (interview: {
  _id: string;
  scheduledTime: Date;
  candidateId: { phone?: string; email: string; firstName: string };
  jobId: { title: string };
  meetingLink?: string;
}): Promise<void> => {
  if (!reminderQueue) return;

  const fireAt = new Date(interview.scheduledTime).getTime() - 60 * 60 * 1000;
  const delay = Math.max(0, fireAt - Date.now());
  if (delay < 60_000) return; // less than 1 minute away — skip

  await reminderQueue.add(
    {
      interviewId:    interview._id,
      candidatePhone: interview.candidateId.phone,
      candidateEmail: interview.candidateId.email,
      candidateName:  interview.candidateId.firstName,
      jobTitle:       interview.jobId.title,
      scheduledTime:  interview.scheduledTime,
      meetingLink:    interview.meetingLink,
    },
    { delay, attempts: 2, removeOnComplete: 100 }
  );
  logger.info(`[ReminderQueue] Reminder enqueued for interview ${interview._id} (fires in ${Math.round(delay / 60000)} min)`);
};

export const enqueueCrossPortalPosting = async (options: {
  jobId: string;
  portals: string[];
  jobData: Record<string, any>;
}) => {
  if (crossPortalQueue) {
    return crossPortalQueue.add(options, {
      attempts:        2,
      backoff:         { type: 'exponential', delay: 10_000 },
      removeOnComplete: 50,
      removeOnFail:    200,
    });
  }
  logger.warn('[CrossPortal] Skipped — Redis not available');
};

// ── Graceful shutdown ─────────────────────────────────────────────────────────

export const closeQueues = async () => {
  await closeEmailQueue();
  const closes = [crossPortalQueue, offerExpiryQueue, jobExpiryQueue, retentionCleanupQueue, reminderQueue]
    .filter(Boolean)
    .map((q) => q!.close());
  await Promise.allSettled(closes);
  logger.info('[Queues] All queues closed gracefully');
};
