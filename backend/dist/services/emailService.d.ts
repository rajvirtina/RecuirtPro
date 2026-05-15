import { emailTemplates } from '../utils/emailTemplates';
interface EmailOptions {
    to: string;
    subject: string;
    template?: keyof typeof emailTemplates;
    data?: Record<string, any>;
    html?: string;
}
/**
 * Send email using configured SMTP
 */
export declare const sendEmail: (options: EmailOptions) => Promise<void>;
/**
 * Send verification email
 */
export declare const sendVerificationEmail: (email: string, name: string, verificationUrl: string) => Promise<void>;
/**
 * Send password reset email
 */
export declare const sendPasswordResetEmail: (email: string, name: string, resetUrl: string) => Promise<void>;
/**
 * Send password changed confirmation email
 */
export declare const sendPasswordChangedEmail: (email: string, name: string) => Promise<void>;
/**
 * Send interview scheduled email
 */
export declare const sendInterviewScheduledEmail: (email: string, data: {
    candidateName: string;
    jobTitle: string;
    interviewDate: string;
    interviewTime: string;
    interviewLink: string;
    interviewType: string;
    proctoringCheckUrl: string;
}) => Promise<void>;
/**
 * Send interview reminder email
 */
export declare const sendInterviewReminderEmail: (email: string, data: {
    candidateName: string;
    jobTitle: string;
    interviewDate: string;
    interviewTime: string;
    interviewLink: string;
}) => Promise<void>;
/**
 * Send application status update email
 */
export declare const sendApplicationStatusEmail: (email: string, data: {
    candidateName: string;
    jobTitle: string;
    status: string;
    message?: string;
}) => Promise<void>;
/**
 * Send shortlisted candidate email
 */
export declare const sendShortlistedEmail: (email: string, data: {
    candidateName: string;
    jobTitle: string;
    nextSteps: string;
}) => Promise<void>;
/**
 * Send job application received email
 */
export declare const sendApplicationReceivedEmail: (email: string, data: {
    candidateName: string;
    jobTitle: string;
    companyName: string;
}) => Promise<void>;
/**
 * Send offer letter email
 */
export declare const sendOfferLetterEmail: (email: string, data: {
    candidateName: string;
    jobTitle: string;
    companyName: string;
    offerLetterUrl: string;
}) => Promise<void>;
/**
 * Send rejection email
 */
export declare const sendRejectionEmail: (email: string, data: {
    candidateName: string;
    jobTitle: string;
    message?: string;
}) => Promise<void>;
export {};
//# sourceMappingURL=emailService.d.ts.map