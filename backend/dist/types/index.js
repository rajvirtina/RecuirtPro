"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfferStatus = exports.IntegrationStatus = exports.SourcingPlatform = exports.AuditAction = exports.JobPortal = exports.CalendarProvider = exports.NotificationType = exports.ProctoringEventType = exports.InterviewTemplate = exports.QuestionDifficulty = exports.InterviewRound = exports.InterviewStatus = exports.ApplicationStatus = exports.WorkMode = exports.JobType = exports.JobStatus = exports.UserStatus = exports.UserRole = void 0;
// User Roles
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["HR"] = "hr";
    UserRole["INTERVIEWER"] = "interviewer";
    UserRole["CANDIDATE"] = "candidate";
    UserRole["EMPLOYER"] = "employer";
})(UserRole || (exports.UserRole = UserRole = {}));
// User Status
var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "active";
    UserStatus["INACTIVE"] = "inactive";
    UserStatus["SUSPENDED"] = "suspended";
    UserStatus["PENDING_VERIFICATION"] = "pending_verification";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
// Job Status
var JobStatus;
(function (JobStatus) {
    JobStatus["DRAFT"] = "draft";
    JobStatus["PUBLISHED"] = "published";
    JobStatus["CLOSED"] = "closed";
    JobStatus["ON_HOLD"] = "on_hold";
    JobStatus["EXPIRED"] = "expired";
})(JobStatus || (exports.JobStatus = JobStatus = {}));
// Job Type
var JobType;
(function (JobType) {
    JobType["FULL_TIME"] = "full_time";
    JobType["PART_TIME"] = "part_time";
    JobType["CONTRACT"] = "contract";
    JobType["INTERNSHIP"] = "internship";
    JobType["TEMPORARY"] = "temporary";
})(JobType || (exports.JobType = JobType = {}));
// Work Mode
var WorkMode;
(function (WorkMode) {
    WorkMode["ONSITE"] = "onsite";
    WorkMode["REMOTE"] = "remote";
    WorkMode["HYBRID"] = "hybrid";
})(WorkMode || (exports.WorkMode = WorkMode = {}));
// Application Status
var ApplicationStatus;
(function (ApplicationStatus) {
    ApplicationStatus["APPLIED"] = "applied";
    ApplicationStatus["SHORTLISTED"] = "shortlisted";
    ApplicationStatus["INTERVIEW_SCHEDULED"] = "interview_scheduled";
    ApplicationStatus["IN_PROGRESS"] = "in_progress";
    ApplicationStatus["SELECTED"] = "selected";
    ApplicationStatus["HIRED"] = "hired";
    ApplicationStatus["OFFER_RELEASED"] = "offer_released";
    ApplicationStatus["REJECTED"] = "rejected";
    ApplicationStatus["ON_HOLD"] = "on_hold";
    ApplicationStatus["WITHDRAWN"] = "withdrawn";
})(ApplicationStatus || (exports.ApplicationStatus = ApplicationStatus = {}));
// Interview Status
var InterviewStatus;
(function (InterviewStatus) {
    InterviewStatus["SCHEDULED"] = "scheduled";
    InterviewStatus["CONFIRMED"] = "confirmed";
    InterviewStatus["IN_PROGRESS"] = "in_progress";
    InterviewStatus["COMPLETED"] = "completed";
    InterviewStatus["CANCELLED"] = "cancelled";
    InterviewStatus["RESCHEDULED"] = "rescheduled";
    InterviewStatus["NO_SHOW"] = "no_show";
})(InterviewStatus || (exports.InterviewStatus = InterviewStatus = {}));
// Interview Round
var InterviewRound;
(function (InterviewRound) {
    InterviewRound["L1"] = "L1";
    InterviewRound["L2"] = "L2";
    InterviewRound["L3"] = "L3";
    InterviewRound["HR"] = "HR";
    InterviewRound["TECHNICAL"] = "technical";
    InterviewRound["MANAGERIAL"] = "managerial";
})(InterviewRound || (exports.InterviewRound = InterviewRound = {}));
// Question Difficulty
var QuestionDifficulty;
(function (QuestionDifficulty) {
    QuestionDifficulty["JUNIOR"] = "junior";
    QuestionDifficulty["SENIOR"] = "senior";
    QuestionDifficulty["EXPERT"] = "expert";
})(QuestionDifficulty || (exports.QuestionDifficulty = QuestionDifficulty = {}));
// Interview Template
var InterviewTemplate;
(function (InterviewTemplate) {
    InterviewTemplate["LOW"] = "low";
    InterviewTemplate["MODERATE"] = "moderate";
    InterviewTemplate["HIGH"] = "high";
})(InterviewTemplate || (exports.InterviewTemplate = InterviewTemplate = {}));
// Proctoring Event Type
var ProctoringEventType;
(function (ProctoringEventType) {
    ProctoringEventType["CONSENT_GIVEN"] = "consent_given";
    ProctoringEventType["CONSENT_DENIED"] = "consent_denied";
    ProctoringEventType["FACE_DETECTED"] = "face_detected";
    ProctoringEventType["FACE_NOT_DETECTED"] = "face_not_detected";
    ProctoringEventType["NO_FACE_DETECTED"] = "no_face_detected";
    ProctoringEventType["MULTIPLE_FACES"] = "multiple_faces";
    ProctoringEventType["GAZE_AWAY"] = "gaze_away";
    ProctoringEventType["TAB_SWITCH"] = "tab_switch";
    ProctoringEventType["WINDOW_BLUR"] = "window_blur";
    ProctoringEventType["UNAUTHORIZED_APP"] = "unauthorized_app";
    ProctoringEventType["EXTERNAL_DEVICE"] = "external_device";
    ProctoringEventType["SCREENSHOT_CAPTURED"] = "screenshot_captured";
    ProctoringEventType["VIOLATION"] = "violation";
    ProctoringEventType["AUDIO_ISSUE"] = "audio_issue";
    ProctoringEventType["VIDEO_ISSUE"] = "video_issue";
    ProctoringEventType["INTERVIEW_STARTED"] = "interview_started";
    ProctoringEventType["INTERVIEW_ENDED"] = "interview_ended";
    ProctoringEventType["SYSTEM_CHECK_PASSED"] = "system_check_passed";
    ProctoringEventType["SYSTEM_CHECK_FAILED"] = "system_check_failed";
    // Desktop app events
    ProctoringEventType["MULTIPLE_BROWSER_TABS"] = "multiple_browser_tabs";
    ProctoringEventType["MULTIPLE_DISPLAYS"] = "multiple_displays";
    ProctoringEventType["SYSTEM_RESOURCE_ISSUE"] = "system_resource_issue";
    ProctoringEventType["SESSION_ACTIVE"] = "session_active";
    ProctoringEventType["SUSPICIOUS_BEHAVIOR"] = "suspicious_behavior";
})(ProctoringEventType || (exports.ProctoringEventType = ProctoringEventType = {}));
// Notification Type
var NotificationType;
(function (NotificationType) {
    NotificationType["EMAIL"] = "email";
    NotificationType["SMS"] = "sms";
    NotificationType["IN_APP"] = "in_app";
    NotificationType["SLACK"] = "slack";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
// Calendar Provider
var CalendarProvider;
(function (CalendarProvider) {
    CalendarProvider["MICROSOFT"] = "microsoft";
    CalendarProvider["GOOGLE"] = "google";
    CalendarProvider["ZOHO"] = "zoho";
})(CalendarProvider || (exports.CalendarProvider = CalendarProvider = {}));
// Job Portal
var JobPortal;
(function (JobPortal) {
    JobPortal["NAUKRI"] = "naukri";
    JobPortal["LINKEDIN"] = "linkedin";
    JobPortal["INTERNAL"] = "internal";
})(JobPortal || (exports.JobPortal = JobPortal = {}));
// Audit Action
var AuditAction;
(function (AuditAction) {
    AuditAction["CREATE"] = "create";
    AuditAction["UPDATE"] = "update";
    AuditAction["DELETE"] = "delete";
    AuditAction["VIEW"] = "view";
    AuditAction["LOGIN"] = "login";
    AuditAction["LOGOUT"] = "logout";
    AuditAction["PASSWORD_CHANGE"] = "password_change";
    AuditAction["STATUS_CHANGE"] = "status_change";
})(AuditAction || (exports.AuditAction = AuditAction = {}));
// Sourcing Platform
var SourcingPlatform;
(function (SourcingPlatform) {
    SourcingPlatform["LINKEDIN"] = "linkedin";
    SourcingPlatform["NAUKRI"] = "naukri";
    SourcingPlatform["GITHUB"] = "github";
})(SourcingPlatform || (exports.SourcingPlatform = SourcingPlatform = {}));
// Sourcing Integration Status
var IntegrationStatus;
(function (IntegrationStatus) {
    IntegrationStatus["CONNECTED"] = "connected";
    IntegrationStatus["DISCONNECTED"] = "disconnected";
    IntegrationStatus["EXPIRED"] = "expired";
    IntegrationStatus["ERROR"] = "error";
})(IntegrationStatus || (exports.IntegrationStatus = IntegrationStatus = {}));
// Offer Status
var OfferStatus;
(function (OfferStatus) {
    OfferStatus["DRAFT"] = "draft";
    OfferStatus["PENDING_APPROVAL"] = "pending_approval";
    OfferStatus["APPROVED"] = "approved";
    OfferStatus["SENT"] = "sent";
    OfferStatus["ACCEPTED"] = "accepted";
    OfferStatus["REJECTED"] = "rejected";
    OfferStatus["NEGOTIATING"] = "negotiating";
    OfferStatus["WITHDRAWN"] = "withdrawn";
    OfferStatus["EXPIRED"] = "expired";
})(OfferStatus || (exports.OfferStatus = OfferStatus = {}));
//# sourceMappingURL=index.js.map