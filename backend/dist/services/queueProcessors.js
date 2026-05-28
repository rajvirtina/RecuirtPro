"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeQueues = exports.enqueueCrossPortalPosting = exports.isRedisAvailable = void 0;
const bull_1 = __importDefault(require("bull"));
const config_1 = require("../config");
const logger_1 = __importDefault(require("../utils/logger"));
const emailService_1 = require("../services/emailService");
// =============================================
// Cross-portal job posting queue
// =============================================
let crossPortalQueue = null;
function initQueues() {
    const redisHost = config_1.config.redis.host;
    if (!redisHost || redisHost === 'localhost' || redisHost.trim() === '') {
        console.log('[Queues] Redis not configured — cross-portal posting disabled');
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
                    console.error('[Queues] Redis connection failed after 3 retries — disabling cross-portal queue');
                    return null;
                }
                return Math.min(times * 1000, 5000);
            },
        };
        if (config_1.config.redis.tls) {
            redisConfig.tls = {};
        }
        crossPortalQueue = new bull_1.default('cross-portal-posting', { redis: redisConfig });
        crossPortalQueue.on('error', (err) => {
            console.error('[CrossPortalQueue] Redis error:', err.message);
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
    }
    catch (err) {
        console.error('[Queues] Failed to initialize cross-portal queue:', err.message);
    }
}
// Initialize on load
initQueues();
/** Reflects email queue Redis status (email queue is owned by emailService) */
const isRedisAvailable = () => (0, emailService_1.isEmailQueueUp)();
exports.isRedisAvailable = isRedisAvailable;
// =============================================
// Cross-portal posting helper
// =============================================
const enqueueCrossPortalPosting = async (options) => {
    if (crossPortalQueue) {
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
    await (0, emailService_1.closeEmailQueue)();
    if (crossPortalQueue)
        await crossPortalQueue.close();
    logger_1.default.info('[Queues] All queues closed gracefully');
};
exports.closeQueues = closeQueues;
//# sourceMappingURL=queueProcessors.js.map
