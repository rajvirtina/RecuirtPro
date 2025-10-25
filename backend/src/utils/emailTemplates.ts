/**
 * Email Templates
 * HTML email templates for various notifications
 */

interface EmailData {
  [key: string]: any;
}

const baseStyles = `
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #4F46E5;
    }
    .content {
      margin-bottom: 30px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #4F46E5;
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
    .button:hover {
      background-color: #4338CA;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #666;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
    .info-box {
      background-color: #F3F4F6;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
    }
  </style>
`;

export const emailTemplates = {
  hrInvitation: (data: EmailData) => `
    <!DOCTYPE html>
    <html>
    <head>
      ${baseStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">RecuirtPro</div>
        </div>
        <div class="content">
          <h2>Welcome to RecuirtPro!</h2>
          <p>Hi ${data.name},</p>
          ${data.isResend ? `
            <p><strong>${data.inviterName}</strong> has resent your invitation to join ${data.companyName} as a <strong>${data.role}</strong>.</p>
          ` : `
            <p><strong>${data.inviterName}</strong> has invited you to join ${data.companyName} as a <strong>${data.role}</strong>.</p>
          `}
          
          <div class="info-box">
            <p><strong>Role:</strong> ${data.role}</p>
            ${data.department ? `<p><strong>Department:</strong> ${data.department}</p>` : ''}
            <p><strong>Invited by:</strong> ${data.inviterName}</p>
          </div>
          
          <p>To complete your registration, please click the button below:</p>
          
          <div style="text-align: center;">
            <a href="${data.invitationUrl}" class="button">Complete Registration</a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${data.invitationUrl}</p>
          
          <div class="info-box" style="background-color: #FEF3C7; border-left: 4px solid #F59E0B;">
            <p style="margin: 0;"><strong>⚠️ Important</strong></p>
            <ul style="margin: 10px 0;">
              <li>This invitation link will expire in ${data.expiryHours} hours</li>
              <li>You will need to create a secure password</li>
              <li>Two-factor authentication (2FA) setup is required for enhanced security</li>
              <li>Please use a strong, unique password</li>
            </ul>
          </div>
          
          <p><strong>What to expect:</strong></p>
          <ol>
            <li>Click the registration link above</li>
            <li>Create a secure password (minimum 8 characters)</li>
            <li>Set up two-factor authentication (2FA)</li>
            <li>Complete your profile</li>
          </ol>
          
          <p>If you have any questions or need assistance, please contact our support team at ${data.supportEmail}</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 SruRaj IT Solutions. All rights reserved.</p>
          <p>RecuirtPro - Recruitment Process Automation Platform</p>
        </div>
      </div>
    </body>
    </html>
  `,

  registrationComplete: (data: EmailData) => `
    <!DOCTYPE html>
    <html>
    <head>
      ${baseStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">RecuirtPro</div>
        </div>
        <div class="content">
          <h2>Welcome Aboard!</h2>
          <p>Hi ${data.name},</p>
          <p>Your registration with RecuirtPro has been completed successfully!</p>
          
          <div class="info-box">
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Role:</strong> ${data.role}</p>
            <p><strong>Account Status:</strong> Active</p>
          </div>
          
          <p>You can now log in to your account and start using RecuirtPro:</p>
          
          <div style="text-align: center;">
            <a href="${data.loginUrl}" class="button">Log In to RecuirtPro</a>
          </div>
          
          <p><strong>Getting Started:</strong></p>
          <ul>
            <li>Complete your profile with additional information</li>
            <li>Familiarize yourself with the dashboard</li>
            <li>Explore recruitment features and tools</li>
            <li>Set up your preferences and notifications</li>
          </ul>
          
          <div class="info-box" style="background-color: #DBEAFE; border-left: 4px solid #3B82F6;">
            <p style="margin: 0;"><strong>🔒 Security Tips</strong></p>
            <ul style="margin: 10px 0;">
              <li>Never share your password with anyone</li>
              <li>Enable two-factor authentication if you haven't already</li>
              <li>Log out when using shared computers</li>
              <li>Report any suspicious activity immediately</li>
            </ul>
          </div>
          
          <p>If you need assistance or have any questions, please don't hesitate to contact our support team at ${data.supportEmail}</p>
          
          <p>We're excited to have you on board!</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 SruRaj IT Solutions. All rights reserved.</p>
          <p>RecuirtPro - Recruitment Process Automation Platform</p>
        </div>
      </div>
    </body>
    </html>
  `,

  passwordResetAttempt: (data: EmailData) => `
    <!DOCTYPE html>
    <html>
    <head>
      ${baseStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">RecuirtPro</div>
        </div>
        <div class="content">
          <h2>Security Alert: Password Reset Attempt</h2>
          <p>Hi ${data.name},</p>
          <p>We detected a password reset attempt for your account.</p>
          
          <div class="info-box" style="background-color: #FEE2E2; border-left: 4px solid #EF4444;">
            <p><strong>⚠️ Security Notice</strong></p>
            <p><strong>Time:</strong> ${data.timestamp}</p>
            <p><strong>IP Address:</strong> ${data.ipAddress}</p>
            <p><strong>Location:</strong> ${data.location || 'Unknown'}</p>
          </div>
          
          <p>If this was you, you can safely ignore this email.</p>
          
          <p><strong>If this wasn't you:</strong></p>
          <ul>
            <li>Your password has NOT been changed yet</li>
            <li>Please change your password immediately</li>
            <li>Enable two-factor authentication if not already enabled</li>
            <li>Contact our support team at ${data.supportEmail}</li>
          </ul>
        </div>
        <div class="footer">
          <p>&copy; 2025 SruRaj IT Solutions. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  emailVerification: (data: EmailData) => `
    <!DOCTYPE html>
    <html>
    <head>
      ${baseStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">RecuirtPro</div>
        </div>
        <div class="content">
          <h2>Verify Your Email Address</h2>
          <p>Hi ${data.name},</p>
          <p>Thank you for registering with RecuirtPro! Please verify your email address by clicking the button below:</p>
          <div style="text-align: center;">
            <a href="${data.verificationUrl}" class="button">Verify Email</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${data.verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account with RecuirtPro, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 RecuirtPro. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  passwordReset: (data: EmailData) => `
    <!DOCTYPE html>
    <html>
    <head>
      ${baseStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">RecuirtPro</div>
        </div>
        <div class="content">
          <h2>Password Reset Request</h2>
          <p>Hi ${data.name},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center;">
            <a href="${data.resetUrl}" class="button">Reset Password</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${data.resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 RecuirtPro. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  passwordChanged: (data: EmailData) => `
    <!DOCTYPE html>
    <html>
    <head>
      ${baseStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">RecuirtPro</div>
        </div>
        <div class="content">
          <h2>Password Changed Successfully</h2>
          <p>Hi ${data.name},</p>
          <p>Your password has been successfully changed.</p>
          <p>If you didn't make this change, please contact our support team immediately.</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 RecuirtPro. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  interviewScheduled: (data: EmailData) => `
    <!DOCTYPE html>
    <html>
    <head>
      ${baseStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">RecuirtPro</div>
        </div>
        <div class="content">
          <h2>Interview Scheduled</h2>
          <p>Hi ${data.candidateName},</p>
          <p>Your interview for the <strong>${data.jobTitle}</strong> position has been scheduled.</p>
          <div class="info-box">
            <p><strong>Date:</strong> ${data.interviewDate}</p>
            <p><strong>Time:</strong> ${data.interviewTime}</p>
            <p><strong>Type:</strong> ${data.interviewType}</p>
          </div>
          
          <div class="info-box" style="background-color: #FEF3C7; border-left: 4px solid #F59E0B;">
            <p style="margin: 0;"><strong>⚠️ Important - System Check Required</strong></p>
            <p style="margin: 10px 0 0 0;">Before joining the interview, you must complete a mandatory system verification to ensure:</p>
            <ul style="margin: 10px 0 0 0;">
              <li>No remote sharing applications are running</li>
              <li>Required peripherals (webcam, microphone) are properly connected</li>
              <li>No unauthorized applications are active</li>
              <li>System meets proctoring requirements</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.proctoringCheckUrl}" class="button" style="background-color: #F59E0B;">
              Complete System Check (Required)
            </a>
          </div>
          
          <p style="color: #991B1B; font-weight: 600;">⚠️ You must complete the system check before the interview time. Failure to do so may result in interview cancellation.</p>
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="${data.interviewLink}" class="button">Join Interview (After System Check)</a>
          </div>
          
          <p><strong>Interview Guidelines:</strong></p>
          <ul>
            <li>Ensure stable internet connection</li>
            <li>Use a quiet, well-lit environment</li>
            <li>Close all unnecessary applications</li>
            <li>Disable screen sharing apps (TeamViewer, AnyDesk, etc.)</li>
            <li>Keep your webcam on throughout the interview</li>
          </ul>
          <p>Good luck!</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 RecuirtPro. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  interviewReminder: (data: EmailData) => `
    <!DOCTYPE html>
    <html>
    <head>
      ${baseStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">RecuirtPro</div>
        </div>
        <div class="content">
          <h2>Interview Reminder</h2>
          <p>Hi ${data.candidateName},</p>
          <p>This is a reminder about your upcoming interview for the <strong>${data.jobTitle}</strong> position.</p>
          <div class="info-box">
            <p><strong>Date:</strong> ${data.interviewDate}</p>
            <p><strong>Time:</strong> ${data.interviewTime}</p>
          </div>
          <div style="text-align: center;">
            <a href="${data.interviewLink}" class="button">Join Interview</a>
          </div>
          <p>Please join a few minutes early to ensure everything is working properly.</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 RecuirtPro. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  applicationStatus: (data: EmailData) => `
    <!DOCTYPE html>
    <html>
    <head>
      ${baseStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">RecuirtPro</div>
        </div>
        <div class="content">
          <h2>Application Update</h2>
          <p>Hi ${data.candidateName},</p>
          <p>Your application for the <strong>${data.jobTitle}</strong> position has been updated.</p>
          <div class="info-box">
            <p><strong>Status:</strong> ${data.status}</p>
            ${data.message ? `<p>${data.message}</p>` : ''}
          </div>
        </div>
        <div class="footer">
          <p>&copy; 2025 RecuirtPro. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  candidateShortlisted: (data: EmailData) => `
    <!DOCTYPE html>
    <html>
    <head>
      ${baseStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">RecuirtPro</div>
        </div>
        <div class="content">
          <h2>Congratulations! You've Been Shortlisted</h2>
          <p>Hi ${data.candidateName},</p>
          <p>Great news! You've been shortlisted for the <strong>${data.jobTitle}</strong> position.</p>
          <div class="info-box">
            <p><strong>Next Steps:</strong></p>
            <p>${data.nextSteps}</p>
          </div>
          <p>We'll be in touch soon with further details.</p>
          <p>Best of luck!</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 RecuirtPro. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  applicationReceived: (data: EmailData) => `
    <!DOCTYPE html>
    <html>
    <head>
      ${baseStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">RecuirtPro</div>
        </div>
        <div class="content">
          <h2>Application Received</h2>
          <p>Hi ${data.candidateName},</p>
          <p>Thank you for applying to the <strong>${data.jobTitle}</strong> position at <strong>${data.companyName}</strong>.</p>
          <p>We have successfully received your application and our team will review it shortly.</p>
          <p>We'll keep you updated on the status of your application.</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 RecuirtPro. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  offerLetter: (data: EmailData) => `
    <!DOCTYPE html>
    <html>
    <head>
      ${baseStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">RecuirtPro</div>
        </div>
        <div class="content">
          <h2>Congratulations! Job Offer</h2>
          <p>Hi ${data.candidateName},</p>
          <p>We are pleased to offer you the position of <strong>${data.jobTitle}</strong> at <strong>${data.companyName}</strong>.</p>
          <div style="text-align: center;">
            <a href="${data.offerLetterUrl}" class="button">View Offer Letter</a>
          </div>
          <p>Please review the offer letter carefully and let us know if you have any questions.</p>
          <p>We look forward to having you on our team!</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 RecuirtPro. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  applicationRejected: (data: EmailData) => `
    <!DOCTYPE html>
    <html>
    <head>
      ${baseStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">RecuirtPro</div>
        </div>
        <div class="content">
          <h2>Application Update</h2>
          <p>Hi ${data.candidateName},</p>
          <p>Thank you for your interest in the <strong>${data.jobTitle}</strong> position.</p>
          <p>After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.</p>
          ${data.message ? `<p>${data.message}</p>` : ''}
          <p>We encourage you to apply for future openings that match your skills and experience.</p>
          <p>We wish you the best in your job search.</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 RecuirtPro. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,
};
