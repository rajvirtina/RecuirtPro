import Bull from 'bull';
import { config } from '../config';
import logger from '../utils/logger';
import { isEmailQueueUp, closeEmailQueue } from '../services/emailService';

// =============================================
// Cross-portal job posting queue
// =============================================
let crossPortalQueue: Bull.Queue | null = null;

function initQueues() {
  const redisHost = config.redis.host;
  if (!redisHost || redisHost === 'localhost' || redisHost.trim() === '') {
    console.log('[Queues] Redis not configured — cross-portal posting disabled');
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
          console.error('[Queues] Redis connection failed after 3 retries — disabling cross-portal queue');
          return null;
        }
        return Math.min(times * 1000, 5000);
      },
    };
    if ((config.redis as any).tls) {
      redisConfig.tls = {};
    }

    crossPortalQueue = new Bull('cross-portal-posting', { redis: redisConfig });

    crossPortalQueue.on('error', (err) => {
      console.error('[CrossPortalQueue] Redis error:', err.message);
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
  } catch (err: any) {
    console.error('[Queues] Failed to initialize cross-portal queue:', err.message);
  }
}

// Initialize on load
initQueues();

/** Reflects email queue Redis status (email queue is owned by emailService) */
export const isRedisAvailable = () => isEmailQueueUp();

// =============================================
// Cross-portal posting helper
// =============================================

export const enqueueCrossPortalPosting = async (options: {
  jobId: string;
  portals: string[];
  jobData: Record<string, any>;
}) => {
  if (crossPortalQueue) {
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
  await closeEmailQueue();
  if (crossPortalQueue) await crossPortalQueue.close();
  logger.info('[Queues] All queues closed gracefully');
};
