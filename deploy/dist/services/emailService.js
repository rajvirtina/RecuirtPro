"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendRejectionEmail = exports.sendOfferLetterEmail = exports.sendApplicationReceivedEmail = exports.sendShortlistedEmail = exports.sendApplicationStatusEmail = exports.sendInterviewReminderEmail = exports.sendInterviewScheduledEmail = exports.sendPasswordChangedEmail = exports.sendPasswordResetEmail = exports.sendVerificationEmail = exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_1 = require("../config");
const logger_1 = __importDefault(require("../utils/logger"));
const emailTemplates_1 = require("../utils/emailTemplates");
// Create reusable transporter
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
/**
 * Send email using configured SMTP
 */
const sendEmail = async (options) => {
    try {
        // In development mode with SKIP_EMAIL, just log instead of sending
        if (process.env.NODE_ENV === 'development' && process.env.SKIP_EMAIL === 'true') {
            logger_1.default.warn(`\n${'='.repeat(80)}`);
            logger_1.default.warn(`[DEV MODE - EMAIL SKIPPED]`);
            logger_1.default.warn(`To: ${options.to}`);
            logger_1.default.warn(`Subject: ${options.subject}`);
            // Highlight invitation URL if present
            if (options.data?.invitationUrl) {
                logger_1.default.warn(`\n🔗 INVITATION URL:`);
                logger_1.default.warn(`${options.data.invitationUrl}`);
                logger_1.default.warn(`\n📋 Copy this URL and send it to the user to complete registration.`);
            }
            logger_1.default.info(`Full Data:`, JSON.stringify(options.data, null, 2));
            logger_1.default.warn(`${'='.repeat(80)}\n`);
            return; // Skip sending email in dev mode
        }
        // Validate configuration
        if (!config_1.config.email.host || !config_1.config.email.user || !config_1.config.email.password) {
            const configError = new Error(`Email configuration incomplete. Required: SMTP_HOST="${config_1.config.email.host}", ` +
                `SMTP_USER="${config_1.config.email.user ? '***' : 'MISSING'}", ` +
                `SMTP_PASSWORD="${config_1.config.email.password ? '***' : 'MISSING'}"`);
            logger_1.default.error('Email configuration validation failed:', configError);
            throw configError;
        }
        const transporter = createTransporter();
        let html;
        // Use provided HTML or generate from template
        if (options.html) {
            html = options.html;
        }
        else if (options.template) {
            // Get template function
            const templateFn = emailTemplates_1.emailTemplates[options.template];
            if (!templateFn) {
                throw new Error(`Email template '${options.template}' not found`);
            }
            // Generate HTML from template
            html = templateFn(options.data || {});
        }
        else {
            throw new Error('Either html or template must be provided');
        }
        // Send email
        const info = await transporter.sendMail({
            from: `${config_1.config.email.fromName} <${config_1.config.email.from}>`,
            to: options.to,
            subject: options.subject,
            html,
        });
        logger_1.default.info(`Email sent successfully to ${options.to}: ${info.messageId}`);
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger_1.default.error(`Failed to send email to ${options.to}: ${errorMsg}`, error);
        throw error;
    }
};
exports.sendEmail = sendEmail;
/**
 * Send verification email
 */
const sendVerificationEmail = async (email, name, verificationUrl) => {
    await (0, exports.sendEmail)({
        to: email,
        subject: 'Verify Your Email - RecuirtPro',
        template: 'emailVerification',
        data: { name, verificationUrl },
    });
};
exports.sendVerificationEmail = sendVerificationEmail;
/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (email, name, resetUrl) => {
    await (0, exports.sendEmail)({
        to: email,
        subject: 'Password Reset Request - RecuirtPro',
        template: 'passwordReset',
        data: { name, resetUrl },
    });
};
exports.sendPasswordResetEmail = sendPasswordResetEmail;
/**
 * Send password changed confirmation email
 */
const sendPasswordChangedEmail = async (email, name) => {
    await (0, exports.sendEmail)({
        to: email,
        subject: 'Password Changed Successfully - RecuirtPro',
        template: 'passwordChanged',
        data: { name },
    });
};
exports.sendPasswordChangedEmail = sendPasswordChangedEmail;
/**
 * Send interview scheduled email
 */
const sendInterviewScheduledEmail = async (email, data) => {
    await (0, exports.sendEmail)({
        to: email,
        subject: `Interview Scheduled - ${data.jobTitle}`,
        template: 'interviewScheduled',
        data,
    });
};
exports.sendInterviewScheduledEmail = sendInterviewScheduledEmail;
/**
 * Send interview reminder email
 */
const sendInterviewReminderEmail = async (email, data) => {
    await (0, exports.sendEmail)({
        to: email,
        subject: `Interview Reminder - ${data.jobTitle}`,
        template: 'interviewReminder',
        data,
    });
};
exports.sendInterviewReminderEmail = sendInterviewReminderEmail;
/**
 * Send application status update email
 */
const sendApplicationStatusEmail = async (email, data) => {
    await (0, exports.sendEmail)({
        to: email,
        subject: `Application Update - ${data.jobTitle}`,
        template: 'applicationStatus',
        data,
    });
};
exports.sendApplicationStatusEmail = sendApplicationStatusEmail;
/**
 * Send shortlisted candidate email
 */
const sendShortlistedEmail = async (email, data) => {
    await (0, exports.sendEmail)({
        to: email,
        subject: `You've Been Shortlisted - ${data.jobTitle}`,
        template: 'candidateShortlisted',
        data,
    });
};
exports.sendShortlistedEmail = sendShortlistedEmail;
/**
 * Send job application received email
 */
const sendApplicationReceivedEmail = async (email, data) => {
    await (0, exports.sendEmail)({
        to: email,
        subject: `Application Received - ${data.jobTitle}`,
        template: 'applicationReceived',
        data,
    });
};
exports.sendApplicationReceivedEmail = sendApplicationReceivedEmail;
/**
 * Send offer letter email
 */
const sendOfferLetterEmail = async (email, data) => {
    await (0, exports.sendEmail)({
        to: email,
        subject: `Job Offer - ${data.jobTitle}`,
        template: 'offerLetter',
        data,
    });
};
exports.sendOfferLetterEmail = sendOfferLetterEmail;
/**
 * Send rejection email
 */
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