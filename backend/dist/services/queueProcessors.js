"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeQueues = exports.enqueueCrossPortalPosting = exports.enqueueEmail = void 0;
const bull_1 = __importDefault(require("bull"));
const config_1 = require("../config");
const logger_1 = __importDefault(require("../utils/logger"));
const emailService_1 = require("../services/emailService");
// =============================================
// Redis availability check
// =============================================
let redisAvailable = false;
let emailQueue = null;
let crossPortalQueue = null;
function initQueues() {
    const redisHost = config_1.config.redis.host;
    if (!redisHost || redisHost === 'localhost' || redisHost.trim() === '') {
        // Skip Redis if not configured or localhost (not available on shared hosting)
        console.log('[Queues] Redis not configured — emails will be sent synchronously');
        return;
    }
    try {
        const redisConfig = {
            host: config_1.config.redis.host,
            port: config_1.config.redis.port,
            password: config_1.config.redis.password || undefined,
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                if (times > 3) {
                    console.error('[Queues] Redis connection failed after 3 retries — disabling queues');
                    redisAvailable = false;
                    return null; // stop retrying
                }
                return Math.min(times * 1000, 5000);
            },
        };
        if (config_1.config.redis.tls) {
            redisConfig.tls = {};
        }
        emailQueue = new bull_1.default('email', { redis: redisConfig });
        crossPortalQueue = new bull_1.default('cross-portal-posting', { redis: redisConfig });
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
            logger_1.default.info(`[EmailQueue] Processing job ${job.id}: ${subject} → ${to}`);
            try {
                await (0, emailService_1.sendEmail)({ to, subject, template, data, html });
                logger_1.default.info(`[EmailQueue] Job ${job.id} completed successfully`);
            }
            catch (error) {
                logger_1.default.error(`[EmailQueue] Job ${job.id} failed:`, error);
                throw error;
            }
        });
        emailQueue.on('failed', (job, err) => {
            logger_1.default.error(`[EmailQueue] Job ${job.id} permanently failed after ${job.attemptsMade} attempts:`, err.message);
        });
        // Cross-portal processor
        crossPortalQueue.process(async (job) => {
            const { jobId, portals, jobData } = job.data;
            logger_1.default.info(`[CrossPortalQueue] Processing job ${job.id}: posting ${jobId} to ${portals.join(', ')}`);
            const results = {};
            for (const portal of portals) {
                try {
                    switch (portal) {
                        case 'naukri':
                        case 'linkedin':
                            logger_1.default.info(`[CrossPortalQueue] Posting to ${portal} (placeholder) for job ${jobId}`);
                            results[portal] = { success: true };
                            break;
                        default:
                            results[portal] = { success: false, error: `Unknown portal: ${portal}` };
                    }
                }
                catch (error) {
                    results[portal] = { success: false, error: error.message };
                }
            }
            return results;
        });
        crossPortalQueue.on('failed', (job, err) => {
            logger_1.default.error(`[CrossPortalQueue] Job ${job.id} failed:`, err.message);
        });
        redisAvailable = true; // optimistic — will be set false on error
    }
    catch (err) {
        console.error('[Queues] Failed to initialize Redis queues:', err.message);
        redisAvailable = false;
    }
}
// Initialize on load
initQueues();
// =============================================
// Helper: Enqueue email (falls back to direct send if Redis unavailable)
// =============================================
const enqueueEmail = async (options) => {
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
        await (0, emailService_1.sendEmail)(options);
        logger_1.default.info(`[Email] Sent directly (no queue): ${options.subject} → ${options.to}`);
    }
    catch (err) {
        logger_1.default.error(`[Email] Direct send failed: ${err.message}`);
    }
};
exports.enqueueEmail = enqueueEmail;
const enqueueCrossPortalPosting = async (options) => {
    if (redisAvailable && crossPortalQueue) {
        return crossPortalQueue.add(options, {
            attempts: 2,
            backoff: { type: 'exponential', delay: 10000 },
            removeOnComplete: 50,
            removeOnFail: 200,
        });
    }
    logger_1.default.warn(`[CrossPortal] Skipped — Redis not available`);
};
exports.enqueueCrossPortalPosting = enqueueCrossPortalPosting;
// =============================================
// Graceful Shutdown
// =============================================
const closeQueues = async () => {
    if (emailQueue)
        await emailQueue.close();
    if (crossPortalQueue)
        await crossPortalQueue.close();
    logger_1.default.info('[Queues] All queues closed gracefully');
};
exports.closeQueues = closeQueues;
//# sourceMappingURL=queueProcessors.js.map