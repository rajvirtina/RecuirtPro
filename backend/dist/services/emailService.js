"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendRejectionEmail = exports.sendOfferLetterEmail = exports.sendApplicationReceivedEmail = exports.sendShortlistedEmail = exports.sendApplicationStatusEmail = exports.sendInterviewReminderEmail = exports.sendInterviewScheduledEmail = exports.sendPasswordChangedEmail = exports.sendPasswordResetEmail = exports.sendVerificationEmail = exports.sendEmail = exports.closeEmailQueue = exports.initEmailService = exports.isEmailQueueUp = void 0;
const bull_1 = __importDefault(require("bull"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_1 = require("../config");
const logger_1 = __importDefault(require("../utils/logger"));
const emailTemplates_1 = require("../utils/emailTemplates");
// ─── SMTP transporter ────────────────────────────────────────────────────────
const createTransporter = () => {
    return nodemailer_1.default.createTransport({
        host: config_1.config.email.host,
        port: config_1.config.email.port,
        secure: config_1.config.email.secure,
        auth: {
            user: config_1.config.email.user,
            pass: config_1.config.email.password,
        },
    });
};
// ─── Queue state ─────────────────────────────────────────────────────────────
let emailQueue = null;
let queueAvailable = false;
const isEmailQueueUp = () => queueAvailable;
exports.isEmailQueueUp = isEmailQueueUp;
// ─── Startup: connect to Redis and register worker ───────────────────────────
async function initEmailService() {
    const redisHost = config_1.config.redis?.host;
    if (!redisHost || redisHost === 'localhost') {
        logger_1.default.warn('[Email] Redis not configured — emails will be sent synchronously');
        return;
    }
    try {
        const redisOpts = {
            host: config_1.config.redis.host,
            port: config_1.config.redis.port,
            password: config_1.config.redis.password || undefined,
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                if (times > 3) {
                    logger_1.default.error('[EmailQueue] Redis connection failed after 3 retries — disabling queue');
                    queueAvailable = false;
                    return null;
                }
                return Math.min(times * 1000, 5000);
            },
        };
        if (config_1.config.redis.tls)
            redisOpts.tls = {};
        emailQueue = new bull_1.default('email', { redis: redisOpts });
        emailQueue.on('error', (err) => {
            logger_1.default.error('[EmailQueue] Redis error:', err.message);
            queueAvailable = false;
        });
        // Worker: must call _sendDirect (not sendEmail) to avoid re-queuing
        emailQueue.process(async (job) => {
            logger_1.default.info(`[EmailQueue] Processing job ${job.id}: ${job.data.subject} → ${job.data.to}`);
            await _sendDirect(job.data);
        });
        emailQueue.on('failed', (job, err) => {
            logger_1.default.error(`[EmailQueue] Job ${job.id} permanently failed after ${job.attemptsMade} attempts: ${err.message}`);
        });
        // Verify Redis is actually reachable
        await emailQueue.client.ping();
        queueAvailable = true;
        logger_1.default.info('[Email] Queue (Redis) connected — async email enabled');
    }
    catch (err) {
        queueAvailable = false;
        emailQueue = null;
        logger_1.default.warn(`[Email] Redis unavailable — emails will be sent synchronously: ${err.message}`);
    }
}
exports.initEmailService = initEmailService;
async function closeEmailQueue() {
    if (emailQueue) {
        await emailQueue.close();
        logger_1.default.info('[EmailQueue] Closed gracefully');
    }
}
exports.closeEmailQueue = closeEmailQueue;
// ─── Internal: raw SMTP send (also used by the queue worker) ─────────────────
async function _sendDirect(options) {
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_EMAIL === 'true') {
        logger_1.default.warn(`\n${'='.repeat(80)}`);
        logger_1.default.warn(`[DEV MODE - EMAIL SKIPPED]`);
        logger_1.default.warn(`To: ${options.to}`);
        logger_1.default.warn(`Subject: ${options.subject}`);
        if (options.data?.invitationUrl) {
            logger_1.default.warn(`\n🔗 INVITATION URL:`);
            logger_1.default.warn(`${options.data.invitationUrl}`);
            logger_1.default.warn(`\n📋 Copy this URL and send it to the user to complete registration.`);
        }
        logger_1.default.info(`Full Data:`, JSON.stringify(options.data, null, 2));
        logger_1.default.warn(`${'='.repeat(80)}\n`);
        return;
    }
    if (!config_1.config.email.host || !config_1.config.email.user || !config_1.config.email.password) {
        throw new Error(`Email configuration incomplete. Required: SMTP_HOST="${config_1.config.email.host}", ` +
            `SMTP_USER="${config_1.config.email.user ? '***' : 'MISSING'}", ` +
            `SMTP_PASSWORD="${config_1.config.email.password ? '***' : 'MISSING'}"`);
    }
    const transporter = createTransporter();
    let html;
    if (options.html) {
        html = options.html;
    }
    else if (options.template) {
        const templateFn = emailTemplates_1.emailTemplates[options.template];
        if (!templateFn)
            throw new Error(`Email template '${options.template}' not found`);
        html = templateFn(options.data || {});
    }
    else {
        throw new Error('Either html or template must be provided');
    }
    const info = await transporter.sendMail({
        from: `${config_1.config.email.fromName} <${config_1.config.email.from}>`,
        to: options.to,
        subject: options.subject,
        html,
    });
    logger_1.default.info(`Email sent successfully to ${options.to}: ${info.messageId}`);
}
// ─── Public API ───────────────────────────────────────────────────────────────
const sendEmail = async (options) => {
    if (queueAvailable && emailQueue) {
        try {
            await emailQueue.add(options, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
                removeOnComplete: 100,
                removeOnFail: 50,
            });
            return;
        }
        catch (err) {
            logger_1.default.warn(`[Email] Queue add failed — falling back to sync: ${err.message}`);
            queueAvailable = false;
        }
    }
    try {
        await _sendDirect(options);
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger_1.default.error(`Failed to send email to ${options.to}: ${errorMsg}`, error);
        throw error;
    }
};
exports.sendEmail = sendEmail;
// ─── Convenience wrappers ─────────────────────────────────────────────────────
const sendVerificationEmail = async (email, name, verificationUrl) => {
    await (0, exports.sendEmail)({
        to: email,
        subject: 'Verify Your Email - RecuirtPro',
        template: 'emailVerification',
        data: { name, verificationUrl },
    });
};
exports.sendVerificationEmail = sendVerificationEmail;
const sendPasswordResetEmail = async (email, name, resetUrl) => {
    await (0, exports.sendEmail)({
        to: email,
        subject: 'Password Reset Request - RecuirtPro',
        template: 'passwordReset',
        data: { name, resetUrl },
    });
};
exports.sendPasswordResetEmail = sendPasswordResetEmail;
const sendPasswordChangedEmail = async (email, name) => {
    await (0, exports.sendEmail)({
        to: email,
        subject: 'Password Changed Successfully - RecuirtPro',
        template: 'passwordChanged',
        data: { name },
    });
};
exports.sendPasswordChangedEmail = sendPasswordChangedEmail;
const sendInterviewScheduledEmail = async (email, data) => {
    await (0, exports.sendEmail)({
        to: email,
        subject: `Interview Scheduled - ${data.jobTitle}`,
        template: 'interviewScheduled',
        data,
    });
};
exports.sendInterviewScheduledEmail = sendInterviewScheduledEmail;
const sendInterviewReminderEmail = async (email, data) => {
    await (0, exports.sendEmail)({
        to: email,
        subject: `Interview Reminder - ${data.jobTitle}`,
        template: 'interviewReminder',
        data,
    });
};
exports.sendInterviewReminderEmail = sendInterviewReminderEmail;
const sendApplicationStatusEmail = async (email, data) => {
    await (0, exports.sendEmail)({
        to: email,
        subject: `Application Update - ${data.jobTitle}`,
        template: 'applicationStatus',
        data,
    });
};
exports.sendApplicationStatusEmail = sendApplicationStatusEmail;
const sendShortlistedEmail = async (email, data) => {
    await (0, exports.sendEmail)({
        to: email,
        subject: `You've Been Shortlisted - ${data.jobTitle}`,
        template: 'candidateShortlisted',
        data,
    });
};
exports.sendShortlistedEmail = sendShortlistedEmail;
const sendApplicationReceivedEmail = async (email, data) => {
    await (0, exports.sendEmail)({
        to: email,
        subject: `Application Received - ${data.jobTitle}`,
        template: 'applicationReceived',
        data,
    });
};
exports.sendApplicationReceivedEmail = sendApplicationReceivedEmail;
const sendOfferLetterEmail = async (email, data) => {
    await (0, exports.sendEmail)({
        to: email,
        subject: `Job Offer - ${data.jobTitle}`,
        template: 'offerLetter',
        data,
    });
};
exports.sendOfferLetterEmail = sendOfferLetterEmail;
const sendRejectionEmail = async (email, data) => {
    await (0, exports.sendEmail)({
        to: email,
        subject: `Application Update - ${data.jobTitle}`,
        template: 'applicationRejected',
        data,
    });
};
exports.sendRejectionEmail = sendRejectionEmail;
//# sourceMappingURL=emailService.js.map
