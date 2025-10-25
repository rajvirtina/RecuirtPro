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

// Create reusable transporter
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

/**
 * Send email using configured SMTP
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    // In development mode with SKIP_EMAIL, just log instead of sending
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_EMAIL === 'true') {
      logger.warn(`\n${'='.repeat(80)}`);
      logger.warn(`[DEV MODE - EMAIL SKIPPED]`);
      logger.warn(`To: ${options.to}`);
      logger.warn(`Subject: ${options.subject}`);
      
      // Highlight invitation URL if present
      if (options.data?.invitationUrl) {
        logger.warn(`\n🔗 INVITATION URL:`);
        logger.warn(`${options.data.invitationUrl}`);
        logger.warn(`\n📋 Copy this URL and send it to the user to complete registration.`);
      }
      
      logger.info(`Full Data:`, JSON.stringify(options.data, null, 2));
      logger.warn(`${'='.repeat(80)}\n`);
      return; // Skip sending email in dev mode
    }

    // Validate configuration
    if (!config.email.host || !config.email.user || !config.email.password) {
      const configError = new Error(
        `Email configuration incomplete. Required: SMTP_HOST="${config.email.host}", ` +
        `SMTP_USER="${config.email.user ? '***' : 'MISSING'}", ` +
        `SMTP_PASSWORD="${config.email.password ? '***' : 'MISSING'}"`
      );
      logger.error('Email configuration validation failed:', configError);
      throw configError;
    }

    const transporter = createTransporter();

    let html: string;
    
    // Use provided HTML or generate from template
    if (options.html) {
      html = options.html;
    } else if (options.template) {
      // Get template function
      const templateFn = emailTemplates[options.template];
      if (!templateFn) {
        throw new Error(`Email template '${options.template}' not found`);
      }
      // Generate HTML from template
      html = templateFn(options.data || {});
    } else {
      throw new Error('Either html or template must be provided');
    }

    // Send email
    const info = await transporter.sendMail({
      from: `${config.email.fromName} <${config.email.from}>`,
      to: options.to,
      subject: options.subject,
      html,
    });

    logger.info(`Email sent successfully to ${options.to}: ${info.messageId}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to send email to ${options.to}: ${errorMsg}`, error);
    throw error;
  }
};

/**
 * Send verification email
 */
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

/**
 * Send password reset email
 */
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

/**
 * Send password changed confirmation email
 */
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

/**
 * Send interview scheduled email
 */
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

/**
 * Send interview reminder email
 */
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

/**
 * Send application status update email
 */
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

/**
 * Send shortlisted candidate email
 */
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

/**
 * Send job application received email
 */
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

/**
 * Send offer letter email
 */
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

/**
 * Send rejection email
 */
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
