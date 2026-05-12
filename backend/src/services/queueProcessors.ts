import Bull from 'bull';
import { config } from '../config';
import logger from '../utils/logger';
import { sendEmail } from '../services/emailService';

// =============================================
// Queue Definitions
// =============================================

const redisConfig: any = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
};
if ((config.redis as any).tls) {
  redisConfig.tls = {};
}

export const emailQueue = new Bull('email', { redis: redisConfig });
export const crossPortalQueue = new Bull('cross-portal-posting', { redis: redisConfig });

// =============================================
// Email Queue Processor
// =============================================

emailQueue.process(async (job) => {
  const { to, subject, template, data, html } = job.data;
  logger.info(`[EmailQueue] Processing job ${job.id}: ${subject} → ${to}`);

  try {
    await sendEmail({ to, subject, template, data, html });
    logger.info(`[EmailQueue] Job ${job.id} completed successfully`);
  } catch (error) {
    logger.error(`[EmailQueue] Job ${job.id} failed:`, error);
    throw error; // Bull will retry based on configured attempts
  }
});

emailQueue.on('failed', (job, err) => {
  logger.error(`[EmailQueue] Job ${job.id} permanently failed after ${job.attemptsMade} attempts:`, err.message);
});

emailQueue.on('completed', (job) => {
  logger.debug(`[EmailQueue] Job ${job.id} completed`);
});

// =============================================
// Cross-Portal Posting Queue Processor
// =============================================

crossPortalQueue.process(async (job) => {
  const { jobId, portals, jobData } = job.data;
  logger.info(`[CrossPortalQueue] Processing job ${job.id}: posting ${jobId} to ${portals.join(', ')}`);

  const results: Record<string, { success: boolean; error?: string }> = {};

  for (const portal of portals) {
    try {
      // Placeholder for portal-specific API integration
      switch (portal) {
        case 'naukri':
          logger.info(`[CrossPortalQueue] Posting to Naukri (placeholder) for job ${jobId}`);
          results[portal] = { success: true };
          break;
        case 'linkedin':
          logger.info(`[CrossPortalQueue] Posting to LinkedIn (placeholder) for job ${jobId}`);
          results[portal] = { success: true };
          break;
        default:
          logger.warn(`[CrossPortalQueue] Unknown portal: ${portal}`);
          results[portal] = { success: false, error: `Unknown portal: ${portal}` };
      }
    } catch (error: any) {
      logger.error(`[CrossPortalQueue] Failed to post to ${portal}:`, error);
      results[portal] = { success: false, error: error.message };
    }
  }

  return results;
});

crossPortalQueue.on('failed', (job, err) => {
  logger.error(`[CrossPortalQueue] Job ${job.id} failed:`, err.message);
});

// =============================================
// Helper: Enqueue email (use instead of direct sendEmail for async delivery)
// =============================================

export const enqueueEmail = async (options: {
  to: string;
  subject: string;
  template?: string;
  data?: Record<string, any>;
  html?: string;
}) => {
  return emailQueue.add(options, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
};

export const enqueueCrossPortalPosting = async (options: {
  jobId: string;
  portals: string[];
  jobData: Record<string, any>;
}) => {
  return crossPortalQueue.add(options, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: 50,
    removeOnFail: 200,
  });
};

// =============================================
// Graceful Shutdown
// =============================================

export const closeQueues = async () => {
  await emailQueue.close();
  await crossPortalQueue.close();
  logger.info('[Queues] All queues closed gracefully');
};
