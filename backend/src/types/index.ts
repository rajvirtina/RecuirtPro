import { Request } from 'express';

// User Roles
export enum UserRole {
  ADMIN = 'admin',
  HR = 'hr',
  INTERVIEWER = 'interviewer',
  CANDIDATE = 'candidate',
  EMPLOYER = 'employer',
}

// User Status
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
}

// Job Status
export enum JobStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CLOSED = 'closed',
  ON_HOLD = 'on_hold',
  EXPIRED = 'expired',
}

// Job Type
export enum JobType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  INTERNSHIP = 'internship',
  TEMPORARY = 'temporary',
}

// Work Mode
export enum WorkMode {
  ONSITE = 'onsite',
  REMOTE = 'remote',
  HYBRID = 'hybrid',
}

// Application Status
export enum ApplicationStatus {
  APPLIED = 'applied',
  SHORTLISTED = 'shortlisted',
  INTERVIEW_SCHEDULED = 'interview_scheduled',
  IN_PROGRESS = 'in_progress',
  SELECTED = 'selected',
  HIRED = 'hired',
  OFFER_RELEASED = 'offer_released',
  REJECTED = 'rejected',
  ON_HOLD = 'on_hold',
  WITHDRAWN = 'withdrawn',
}

// Interview Status
export enum InterviewStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  RESCHEDULED = 'rescheduled',
  NO_SHOW = 'no_show',
}

// Interview Round
export enum InterviewRound {
  L1 = 'L1',
  L2 = 'L2',
  L3 = 'L3',
  HR = 'HR',
  TECHNICAL = 'technical',
  MANAGERIAL = 'managerial',
}

// Question Difficulty
export enum QuestionDifficulty {
  JUNIOR = 'junior',
  SENIOR = 'senior',
  EXPERT = 'expert',
}

// Interview Template
export enum InterviewTemplate {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
}

// Proctoring Event Type
export enum ProctoringEventType {
  CONSENT_GIVEN = 'consent_given',
  CONSENT_DENIED = 'consent_denied',
  FACE_DETECTED = 'face_detected',
  FACE_NOT_DETECTED = 'face_not_detected',
  NO_FACE_DETECTED = 'no_face_detected',
  MULTIPLE_FACES = 'multiple_faces',
  GAZE_AWAY = 'gaze_away',
  TAB_SWITCH = 'tab_switch',
  WINDOW_BLUR = 'window_blur',
  UNAUTHORIZED_APP = 'unauthorized_app',
  EXTERNAL_DEVICE = 'external_device',
  SCREENSHOT_CAPTURED = 'screenshot_captured',
  VIOLATION = 'violation',
  AUDIO_ISSUE = 'audio_issue',
  VIDEO_ISSUE = 'video_issue',
  INTERVIEW_STARTED = 'interview_started',
  INTERVIEW_ENDED = 'interview_ended',
  SYSTEM_CHECK_PASSED = 'system_check_passed',
  SYSTEM_CHECK_FAILED = 'system_check_failed',
  // Desktop app events
  MULTIPLE_BROWSER_TABS = 'multiple_browser_tabs',
  MULTIPLE_DISPLAYS = 'multiple_displays',
  SYSTEM_RESOURCE_ISSUE = 'system_resource_issue',
  SESSION_ACTIVE = 'session_active',
  SUSPICIOUS_BEHAVIOR = 'suspicious_behavior',
}

// Notification Type
export enum NotificationType {
  EMAIL = 'email',
  SMS = 'sms',
  IN_APP = 'in_app',
  SLACK = 'slack',
}

// Calendar Provider
export enum CalendarProvider {
  MICROSOFT = 'microsoft',
  GOOGLE = 'google',
  ZOHO = 'zoho',
}

// Job Portal
export enum JobPortal {
  NAUKRI = 'naukri',
  LINKEDIN = 'linkedin',
  INTERNAL = 'internal',
}

// Audit Action
export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  VIEW = 'view',
  LOGIN = 'login',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  STATUS_CHANGE = 'status_change',
}

// Sourcing Platform
export enum SourcingPlatform {
  LINKEDIN = 'linkedin',
  NAUKRI = 'naukri',
  GITHUB = 'github',
}

// Sourcing Integration Status
export enum IntegrationStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  EXPIRED = 'expired',
  ERROR = 'error',
}

// Offer Status
export enum OfferStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  SENT = 'sent',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  NEGOTIATING = 'negotiating',
  WITHDRAWN = 'withdrawn',
  EXPIRED = 'expired',
}

// User Interface
export interface IUser {
  _id: string;
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  firstName: string;
  lastName: string;
  phone?: string;
  timezone: string;
  companyId?: string;
  isSuperAdminUser?: boolean;
  profileImage?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  mfaEnabled: boolean;
  mfaSecret?: string;
  lastLogin?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Request with User
export interface AuthRequest extends Request {
  user?: IUser;
}

// API Response
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: any[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Pagination Query
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

// Job Posting
export interface IJobPosting {
  portal: JobPortal;
  postedAt?: Date;
  externalId?: string;
  status: 'pending' | 'posted' | 'failed';
  error?: string;
  retryCount: number;
}

// Status History
export interface IStatusHistory {
  status: ApplicationStatus;
  changedBy: string;
  changedAt: Date;
  remarks?: string;
}

// Interview Panel Member
export interface IPanelMember {
  userId: string;
  name: string;
  email: string;
  role: string;
}

// Calendar Integration
export interface ICalendarIntegration {
  provider: CalendarProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  calendarId?: string;
  email: string;
}

// Resume Source
export interface IResumeSource {
  portal: JobPortal;
  externalId?: string;
  url?: string;
}

// Skill
export interface ISkill {
  name: string;
  yearsOfExperience?: number;
  proficiency?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

// Education
export interface IEducation {
  degree: string;
  institution: string;
  fieldOfStudy?: string;
  startDate?: Date;
  endDate?: Date;
  current?: boolean;
}

// Work Experience
export interface IWorkExperience {
  company: string;
  position: string;
  startDate: Date;
  endDate?: Date;
  current: boolean;
  description?: string;
}
