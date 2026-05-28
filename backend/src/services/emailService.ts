import Bull from 'bull';
import nodemailer from 'nodemailer';
import { config } from '../config';
import logger from '../utils/logger';
import { emailTemplates } from '../utils/emailTemplates';

interface EmailOptions {
  to: string;
  subject: string;
  template?: keyof typeof emailTemplates;
  data?: Record<string, any>;
  html?: string;
}

// ─── SMTP transporter ────────────────────────────────────────────────────────

const createTransporter = () => {
  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.password,
    },
  });
};

// ─── Queue state ─────────────────────────────────────────────────────────────

let emailQueue: Bull.Queue | null = null;
let queueAvailable = false;

/** Exposed to health check and queueProcessors' isRedisAvailable() */
export const isEmailQueueUp = (): boolean => queueAvailable;

// ─── Startup: connect to Redis and register worker ───────────────────────────

/**
 * Call once in server.ts after DB connects.
 * Creates the Bull queue, verifies Redis is reachable, and registers the
 * queue worker.  On any failure the service degrades to synchronous SMTP.
 */
export async function initEmailService(): Promise<void> {
  const redisHost = config.redis?.host;
  if (!redisHost || redisHost === 'localhost') {
    logger.warn('[Email] Redis not configured — emails will be sent synchronously');
    return;
  }

  try {
    const redisOpts: any = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          logger.error('[EmailQueue] Redis connection failed after 3 retries — disabling queue');
          queueAvailable = false;
          return null; // stop retrying
        }
        return Math.min(times * 1000, 5000);
      },
    };
    if ((config.redis as any).tls) redisOpts.tls = {};

    emailQueue = new Bull('email', { redis: redisOpts });

    emailQueue.on('error', (err) => {
      logger.error('[EmailQueue] Redis error:', err.message);
      queueAvailable = false;
    });

    // Worker: must call _sendDirect (not sendEmail) to avoid re-queuing
    emailQueue.process(async (job) => {
      logger.info(`[EmailQueue] Processing job ${job.id}: ${job.data.subject} → ${job.data.to}`);
      await _sendDirect(job.data);
    });

    emailQueue.on('failed', (job, err) => {
      logger.error(`[EmailQueue] Job ${job.id} permanently failed after ${job.attemptsMade} attempts: ${err.message}`);
    });

    // Verify Redis is actually reachable
    await (emailQueue as any).client.ping();
    queueAvailable = true;
    logger.info('[Email] Queue (Redis) connected — async email enabled');
  } catch (err: any) {
    queueAvailable = false;
    emailQueue = null;
    logger.warn(`[Email] Redis unavailable — emails will be sent synchronously: ${err.message}`);
  }
}

export async function closeEmailQueue(): Promise<void> {
  if (emailQueue) {
    await emailQueue.close();
    logger.info('[EmailQueue] Closed gracefully');
  }
}

// ─── Internal: raw SMTP send (also used by the queue worker) ─────────────────

async function _sendDirect(options: EmailOptions): Promise<void> {
  // In development mode with SKIP_EMAIL, just log instead of sending
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_EMAIL === 'true') {
    logger.warn(`\n${'='.repeat(80)}`);
    logger.warn(`[DEV MODE - EMAIL SKIPPED]`);
    logger.warn(`To: ${options.to}`);
    logger.warn(`Subject: ${options.subject}`);

    if (options.data?.invitationUrl) {
      logger.warn(`\n🔗 INVITATION URL:`);
      logger.warn(`${options.data.invitationUrl}`);
      logger.warn(`\n📋 Copy this URL and send it to the user to complete registration.`);
    }

    logger.info(`Full Data:`, JSON.stringify(options.data, null, 2));
    logger.warn(`${'='.repeat(80)}\n`);
    return;
  }

  if (!config.email.host || !config.email.user || !config.email.password) {
    throw new Error(
      `Email configuration incomplete. Required: SMTP_HOST="${config.email.host}", ` +
      `SMTP_USER="${config.email.user ? '***' : 'MISSING'}", ` +
      `SMTP_PASSWORD="${config.email.password ? '***' : 'MISSING'}"`
    );
  }

  const transporter = createTransporter();
  let html: string;

  if (options.html) {
    html = options.html;
  } else if (options.template) {
    const templateFn = emailTemplates[options.template];
    if (!templateFn) throw new Error(`Email template '${options.template}' not found`);
    html = templateFn(options.data || {});
  } else {
    throw new Error('Either html or template must be provided');
  }

  const info = await transporter.sendMail({
    from: `${config.email.fromName} <${config.email.from}>`,
    to: options.to,
    subject: options.subject,
    html,
  });

  logger.info(`Email sent successfully to ${options.to}: ${info.messageId}`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send email via queue (async, Redis-backed) when available,
 * falling back to direct synchronous SMTP.
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  if (queueAvailable && emailQueue) {
    try {
      await emailQueue.add(options, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      });
      return;
    } catch (err: any) {
      logger.warn(`[Email] Queue add failed — falling back to sync: ${err.message}`);
      queueAvailable = false;
    }
  }
  // Fallback: synchronous direct send
  try {
    await _sendDirect(options);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to send email to ${options.to}: ${errorMsg}`, error);
    throw error;
  }
};

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export const sendVerificationEmail = async (
  email: string,
  name: string,
  verificationUrl: string
): Promise<void> => {
  await sendEmail({
    to: email,
    subject: 'Verify Your Email - RecuirtPro',
    template: 'emailVerification',
    data: { name, verificationUrl },
  });
};

export const sendPasswordResetEmail = async (
  email: string,
  name: string,
  resetUrl: string
): Promise<void> => {
  await sendEmail({
    to: email,
    subject: 'Password Reset Request - RecuirtPro',
    template: 'passwordReset',
    data: { name, resetUrl },
  });
};

export const sendPasswordChangedEmail = async (
  email: string,
  name: string
): Promise<void> => {
  await sendEmail({
    to: email,
    subject: 'Password Changed Successfully - RecuirtPro',
    template: 'passwordChanged',
    data: { name },
  });
};

export const sendInterviewScheduledEmail = async (
  email: string,
  data: {
    candidateName: string;
    jobTitle: string;
    interviewDate: string;
    interviewTime: string;
    interviewLink: string;
    interviewType: string;
    proctoringCheckUrl: string;
  }
): Promise<void> => {
  await sendEmail({
    to: email,
    subject: `Interview Scheduled - ${data.jobTitle}`,
    template: 'interviewScheduled',
    data,
  });
};

export const sendInterviewReminderEmail = async (
  email: string,
  data: {
    candidateName: string;
    jobTitle: string;
    interviewDate: string;
    interviewTime: string;
    interviewLink: string;
  }
): Promise<void> => {
  await sendEmail({
    to: email,
    subject: `Interview Reminder - ${data.jobTitle}`,
    template: 'interviewReminder',
    data,
  });
};

export const sendApplicationStatusEmail = async (
  email: string,
  data: {
    candidateName: string;
    jobTitle: string;
    status: string;
    message?: string;
  }
): Promise<void> => {
  await sendEmail({
    to: email,
    subject: `Application Update - ${data.jobTitle}`,
    template: 'applicationStatus',
    data,
  });
};

export const sendShortlistedEmail = async (
  email: string,
  data: {
    candidateName: string;
    jobTitle: string;
    nextSteps: string;
  }
): Promise<void> => {
  await sendEmail({
    to: email,
    subject: `You've Been Shortlisted - ${data.jobTitle}`,
    template: 'candidateShortlisted',
    data,
  });
};

export const sendApplicationReceivedEmail = async (
  email: string,
  data: {
    candidateName: string;
    jobTitle: string;
    companyName: string;
  }
): Promise<void> => {
  await sendEmail({
    to: email,
    subject: `Application Received - ${data.jobTitle}`,
    template: 'applicationReceived',
    data,
  });
};

export const sendOfferLetterEmail = async (
  email: string,
  data: {
    candidateName: string;
    jobTitle: string;
    companyName: string;
    offerLetterUrl: string;
  }
): Promise<void> => {
  await sendEmail({
    to: email,
    subject: `Job Offer - ${data.jobTitle}`,
    template: 'offerLetter',
    data,
  });
};

export const sendRejectionEmail = async (
  email: string,
  data: {
    candidateName: string;
    jobTitle: string;
    message?: string;
  }
): Promise<void> => {
  await sendEmail({
    to: email,
    subject: `Application Update - ${data.jobTitle}`,
    template: 'applicationRejected',
    data,
  });
};
