export interface User {
  _id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  firstName: string;
  lastName: string;
  phone?: string;
  timezone: string;
  companyId?: string;
  profileImage?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  mfaEnabled: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  ADMIN = 'admin',
  HR = 'hr',
  INTERVIEWER = 'interviewer',
  CANDIDATE = 'candidate',
  EMPLOYER = 'employer',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
}

export enum JobStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CLOSED = 'closed',
  ON_HOLD = 'on_hold',
  EXPIRED = 'expired',
}

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

export enum InterviewStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  RESCHEDULED = 'rescheduled',
  NO_SHOW = 'no_show',
}

export interface Job {
  _id: string;
  companyId: string;
  title: string;
  description: string;
  skills: string[];
  experienceMin: number;
  experienceMax: number;
  salaryMin?: number;
  salaryMax?: number;
  location: string;
  workMode: 'onsite' | 'remote' | 'hybrid';
  jobType: 'full_time' | 'part_time' | 'contract' | 'internship';
  status: JobStatus;
  applicationCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Application {
  _id: string;
  jobId: string;
  candidateId: string;
  status: ApplicationStatus;
  skillMatchScore?: number;
  experienceMatchScore?: number;
  overallScore?: number;
  appliedAt: string;
  job?: Job;
}

export interface Interview {
  _id: string;
  applicationId: string;
  jobId: string;
  candidateId: string;
  round: string;
  scheduledTime: string;
  duration: number;
  status: InterviewStatus;
  meetingLink?: string;
  proctoringEnabled: boolean;
  proctoringConsent?: boolean;
  job?: Job;
}

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

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  phone?: string;
  companySlug?: string;
  invitationToken?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}
