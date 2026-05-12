import Bull from 'bull';
import { config } from '../config';
import logger from '../utils/logger';
import { sendEmail } from '../services/emailService';

// =============================================
// Redis availability check
// =============================================
let redisAvailable = false;
let emailQueue: Bull.Queue | null = null;
let crossPortalQueue: Bull.Queue | null = null;

function initQueues() {
  if (!config.redis.host || config.redis.host === 'localhost') {
    // Skip Redis if not configured or localhost (not available on shared hosting)
    console.log('[Queues] Redis not configured — emails will be sent synchronously');
    return;
  }

  try {
    const redisConfig: any = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.error('[Queues] Redis connection failed after 3 retries — disabling queues');
          redisAvailable = false;
          return null; // stop retrying
        }
        return Math.min(times * 1000, 5000);
      },
    };
    if ((config.redis as any).tls) {
      redisConfig.tls = {};
    }

    emailQueue = new Bull('email', { redis: redisConfig });
    crossPortalQueue = new Bull('cross-portal-posting', { redis: redisConfig });

    emailQueue.on('error', (err) => {
      console.error('[EmailQueue] Redis error:', err.message);
      redisAvailable = false;
    });
    crossPortalQueue.on('error', (err) => {
      console.error('[CrossPortalQueue] Redis error:', err.message);
    });
    emailQueue.on('ready', () => {
      redisAvailable = true;
      console.log('[Queues] Redis connected — queue mode active');
    });

    // Email processor
    emailQueue.process(async (job) => {
      const { to, subject, template, data, html } = job.data;
      logger.info(`[EmailQueue] Processing job ${job.id}: ${subject} → ${to}`);
      try {
        await sendEmail({ to, subject, template, data, html });
        logger.info(`[EmailQueue] Job ${job.id} completed successfully`);
      } catch (error) {
        logger.error(`[EmailQueue] Job ${job.id} failed:`, error);
        throw error;
      }
    });

    emailQueue.on('failed', (job, err) => {
      logger.error(`[EmailQueue] Job ${job.id} permanently failed after ${job.attemptsMade} attempts:`, err.message);
    });

    // Cross-portal processor
    crossPortalQueue.process(async (job) => {
      const { jobId, portals, jobData } = job.data;
      logger.info(`[CrossPortalQueue] Processing job ${job.id}: posting ${jobId} to ${portals.join(', ')}`);
      const results: Record<string, { success: boolean; error?: string }> = {};
      for (const portal of portals) {
        try {
          switch (portal) {
            case 'naukri':
            case 'linkedin':
              logger.info(`[CrossPortalQueue] Posting to ${portal} (placeholder) for job ${jobId}`);
              results[portal] = { success: true };
              break;
            default:
              results[portal] = { success: false, error: `Unknown portal: ${portal}` };
          }
        } catch (error: any) {
          results[portal] = { success: false, error: error.message };
        }
      }
      return results;
    });

    crossPortalQueue.on('failed', (job, err) => {
      logger.error(`[CrossPortalQueue] Job ${job.id} failed:`, err.message);
    });

    redisAvailable = true; // optimistic — will be set false on error
  } catch (err: any) {
    console.error('[Queues] Failed to initialize Redis queues:', err.message);
    redisAvailable = false;
  }
}

// Initialize on load
initQueues();

// =============================================
// Helper: Enqueue email (falls back to direct send if Redis unavailable)
// =============================================

export const enqueueEmail = async (options: {
  to: string;
  subject: string;
  template?: string;
  data?: Record<string, any>;
  html?: string;
}) => {
  if (redisAvailable && emailQueue) {
    return emailQueue.add(options, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }
  // Fallback: send directly
  try {
    await sendEmail(options as any);
    logger.info(`[Email] Sent directly (no queue): ${options.subject} → ${options.to}`);
  } catch (err: any) {
    logger.error(`[Email] Direct send failed: ${err.message}`);
  }
};

export const enqueueCrossPortalPosting = async (options: {
  jobId: string;
  portals: string[];
  jobData: Record<string, any>;
}) => {
  if (redisAvailable && crossPortalQueue) {
    return crossPortalQueue.add(options, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: 50,
      removeOnFail: 200,
    });
  }
  logger.warn(`[CrossPortal] Skipped — Redis not available`);
};

// =============================================
// Graceful Shutdown
// =============================================

export const closeQueues = async () => {
  if (emailQueue) await emailQueue.close();
  if (crossPortalQueue) await crossPortalQueue.close();
  logger.info('[Queues] All queues closed gracefully');
};
