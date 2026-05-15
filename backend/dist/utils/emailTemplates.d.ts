/**
 * Email Templates
 * HTML email templates for various notifications
 */
interface EmailData {
    [key: string]: any;
}
export declare const emailTemplates: {
    hrInvitation: (data: EmailData) => string;
    registrationComplete: (data: EmailData) => string;
    passwordResetAttempt: (data: EmailData) => string;
    emailVerification: (data: EmailData) => string;
    passwordReset: (data: EmailData) => string;
    passwordChanged: (data: EmailData) => string;
    interviewScheduled: (data: EmailData) => string;
    interviewReminder: (data: EmailData) => string;
    applicationStatus: (data: EmailData) => string;
    candidateShortlisted: (data: EmailData) => string;
    applicationReceived: (data: EmailData) => string;
    offerLetter: (data: EmailData) => string;
    applicationRejected: (data: EmailData) => string;
};
export {};
//# sourceMappingURL=emailTemplates.d.ts.map