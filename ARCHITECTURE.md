# RecuirtPro - System Architecture

## Table of Contents
1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [System Architecture](#system-architecture)
4. [Database Schema](#database-schema)
5. [API Design](#api-design)
6. [Authentication Flow](#authentication-flow)
7. [Integration Architecture](#integration-architecture)
8. [Proctoring System](#proctoring-system)
9. [Security](#security)
10. [Scalability](#scalability)

## Overview

RecuirtPro is an end-to-end recruitment automation platform that streamlines the hiring process from job posting to offer release, with integrated calendar management, interview proctoring, and multi-portal candidate sourcing.

## Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB 6.0+
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: express-validator
- **File Storage**: AWS S3
- **Queue System**: Bull (Redis-based)
- **Email**: Nodemailer
- **Documentation**: Swagger/OpenAPI

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod
- **Real-time**: Socket.IO client

### Infrastructure
- **Cache/Queue**: Redis
- **Search**: Elasticsearch (optional)
- **Logging**: Winston
- **Monitoring**: (TBD - Datadog/New Relic)
- **Deployment**: (TBD - AWS/Azure/GCP)

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  React App (Vite)  │  Candidate Proctoring Plugin               │
│  - HR Dashboard    │  - Face Detection                          │
│  - Candidate Portal│  - Eye Tracking                            │
│  - Admin Panel     │  - System Monitoring                       │
└──────────────┬──────────────────────────────────────────────────┘
               │
               │ HTTPS/WSS
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  Express.js Server                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   REST API   │  │  WebSocket   │  │   Swagger    │          │
│  │  Controllers │  │   (Socket.io)│  │     Docs     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────────────────────────────────────────┐          │
│  │              Middleware Layer                     │          │
│  │  - Auth (JWT)  - Rate Limit  - Error Handler     │          │
│  │  - RBAC       - Validation   - Audit Logger      │          │
│  └──────────────────────────────────────────────────┘          │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Auth      │  │ Job Posting  │  │  Interview   │           │
│  │  Service    │  │   Service    │  │   Service    │           │
│  └─────────────┘  └──────────────┘  └──────────────┘           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  Candidate  │  │   Calendar   │  │  Proctoring  │           │
│  │   Service   │  │   Service    │  │   Service    │           │
│  └─────────────┘  └──────────────┘  └──────────────┘           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Email     │  │   Resume     │  │ Notification │           │
│  │   Service   │  │   Parser     │  │   Service    │           │
│  └─────────────┘  └──────────────┘  └──────────────┘           │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   MongoDB    │  │    Redis     │  │     S3       │          │
│  │  (Primary)   │  │ (Cache/Queue)│  │   (Files)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  EXTERNAL INTEGRATIONS                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Naukri     │  │  Microsoft   │  │   Google     │          │
│  │     API      │  │    Graph     │  │   Calendar   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    Zoho      │  │   SendGrid   │  │   Twilio     │          │
│  │   Calendar   │  │    (Email)   │  │    (SMS)     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Core Collections

#### Users
```typescript
{
  _id: ObjectId,
  email: string (unique, indexed),
  password: string (hashed),
  role: enum [admin, hr, interviewer, candidate, employer],
  status: enum [active, inactive, suspended, pending_verification],
  firstName: string,
  lastName: string,
  phone: string,
  timezone: string,
  companyId: ObjectId (ref: Company),
  emailVerified: boolean,
  mfaEnabled: boolean,
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date (soft delete)
}
```

#### Companies
```typescript
{
  _id: ObjectId,
  name: string,
  email: string,
  settings: {
    enableProctoring: boolean,
    enableNaukriIntegration: boolean,
    dataRetentionDays: number
  },
  status: enum [active, inactive, suspended],
  createdAt: Date,
  updatedAt: Date
}
```

#### Jobs
```typescript
{
  _id: ObjectId,
  companyId: ObjectId (indexed),
  title: string,
  description: string,
  skills: string[] (indexed),
  experienceMin: number,
  experienceMax: number,
  location: string (indexed),
  workMode: enum [onsite, remote, hybrid],
  status: enum [draft, published, closed, on_hold, expired],
  postings: [{
    portal: string,
    status: enum [pending, posted, failed],
    externalId: string
  }],
  applicationCount: number,
  createdAt: Date,
  expiryDate: Date (indexed)
}
```

#### Applications
```typescript
{
  _id: ObjectId,
  jobId: ObjectId (indexed),
  candidateId: ObjectId (indexed),
  companyId: ObjectId (indexed),
  status: enum [applied, shortlisted, interview_scheduled, ...],
  statusHistory: [{
    status: string,
    changedBy: ObjectId,
    changedAt: Date
  }],
  skillMatchScore: number,
  overallScore: number (indexed),
  appliedAt: Date,
  unique: [jobId, candidateId]
}
```

#### Interviews
```typescript
{
  _id: ObjectId,
  applicationId: ObjectId,
  candidateId: ObjectId (indexed),
  scheduledTime: Date (indexed),
  duration: number,
  status: enum [scheduled, confirmed, completed, ...],
  meetingLink: string,
  calendarProvider: enum [microsoft, google, zoho],
  panel: [{userId, name, email, role}],
  proctoringEnabled: boolean,
  proctoringConsent: boolean,
  feedback: [{
    interviewerId: ObjectId,
    rating: number,
    recommendation: string
  }],
  completedAt: Date
}
```

#### ProctoringEvents
```typescript
{
  _id: ObjectId,
  interviewId: ObjectId (indexed),
  candidateId: ObjectId (indexed),
  eventType: enum [face_detected, gaze_away, tab_switch, ...],
  severity: enum [low, medium, high, critical],
  timestamp: Date (indexed),
  snapshotUrl: string,
  metadata: object,
  reviewed: boolean
}
```

### Indexes Strategy

```javascript
// High-priority indexes
Users: { email: 1, deletedAt: 1 }
Jobs: { companyId: 1, status: 1 }
Jobs: { skills: 1 }
Applications: { jobId: 1, candidateId: 1 } (unique)
Applications: { overallScore: -1 }
Interviews: { candidateId: 1, scheduledTime: -1 }
ProctoringEvents: { interviewId: 1, timestamp: -1 }
```

## API Design

### Authentication Endpoints
```
POST   /api/auth/register          - Register new user
POST   /api/auth/login             - Login
POST   /api/auth/logout            - Logout
POST   /api/auth/refresh           - Refresh access token
GET    /api/auth/me                - Get current user
POST   /api/auth/verify-email      - Verify email
POST   /api/auth/forgot-password   - Request password reset
POST   /api/auth/reset-password    - Reset password
```

### Jobs Endpoints
```
GET    /api/jobs                   - List jobs (with filters)
POST   /api/jobs                   - Create job (HR)
GET    /api/jobs/:id               - Get job details
PUT    /api/jobs/:id               - Update job (HR)
DELETE /api/jobs/:id               - Delete job (HR)
POST   /api/jobs/:id/publish       - Publish to portals (HR)
GET    /api/jobs/:id/applications  - Get job applications (HR)
```

### Applications Endpoints
```
GET    /api/applications           - List applications
POST   /api/applications           - Apply to job (Candidate)
GET    /api/applications/:id       - Get application details
PATCH  /api/applications/:id/status - Update status (HR)
POST   /api/applications/:id/notes  - Add notes (HR)
```

### Interviews Endpoints
```
GET    /api/interviews             - List interviews
POST   /api/interviews             - Schedule interview (HR)
GET    /api/interviews/:id         - Get interview details
PATCH  /api/interviews/:id         - Update interview
POST   /api/interviews/:id/confirm - Confirm attendance (Candidate)
POST   /api/interviews/:id/feedback - Submit feedback (Interviewer)
```

### Proctoring Endpoints
```
POST   /api/proctoring/consent     - Record consent
POST   /api/proctoring/events      - Log proctoring event
GET    /api/proctoring/interviews/:id/events - Get events
GET    /api/proctoring/interviews/:id/report - Generate report
```

## Authentication Flow

```
┌──────────┐                           ┌──────────┐
│  Client  │                           │  Server  │
└────┬─────┘                           └────┬─────┘
     │                                      │
     │  POST /auth/login                    │
     │  { email, password }                 │
     │─────────────────────────────────────>│
     │                                      │
     │                              [Validate credentials]
     │                              [Generate JWT tokens]
     │                                      │
     │  { token, refreshToken, user }       │
     │<─────────────────────────────────────│
     │                                      │
     │ [Store tokens in localStorage]       │
     │                                      │
     │  GET /api/jobs                       │
     │  Authorization: Bearer <token>       │
     │─────────────────────────────────────>│
     │                                      │
     │                              [Verify JWT]
     │                              [Check RBAC]
     │                                      │
     │  { success: true, data: [...] }      │
     │<─────────────────────────────────────│
     │                                      │
     │ [Token expires]                      │
     │                                      │
     │  POST /auth/refresh                  │
     │  { refreshToken }                    │
     │─────────────────────────────────────>│
     │                                      │
     │                              [Validate refresh token]
     │                              [Generate new access token]
     │                                      │
     │  { token }                           │
     │<─────────────────────────────────────│
     │                                      │
```

## Integration Architecture

### Microsoft Graph (Teams)
```typescript
// OAuth2 Flow
1. Redirect to Microsoft OAuth endpoint
2. Receive auth code
3. Exchange code for tokens
4. Store encrypted tokens in CalendarIntegration collection
5. Use tokens to create Teams meetings
6. Subscribe to webhooks for meeting updates
```

### Naukri Integration
```typescript
// Job Posting
1. HR creates job in system
2. Background job queues posting to Naukri
3. API call to Naukri with job details
4. Store external job ID
5. Poll for status updates

// Candidate Sourcing
1. Configure search criteria
2. Scheduled job fetches candidates
3. Parse resume data
4. Calculate match scores
5. Auto-shortlist top candidates
6. Email HR with shortlist
```

## Proctoring System

### Architecture
```
┌─────────────────────────────────────────────────────────┐
│           Candidate Browser/Plugin                      │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Webcam     │  │  Face API.js │  │ System Check │ │
│  │   Access     │  │  Detection   │  │   Module     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │         Event Capture & Logging                  │  │
│  │  - Face detection  - Gaze tracking               │  │
│  │  - Tab switches   - External devices             │  │
│  └─────────────────────────────────────────────────┘  │
└──────────────┬──────────────────────────────────────────┘
               │ WebSocket
               ▼
┌─────────────────────────────────────────────────────────┐
│              Backend Proctoring Service                 │
├─────────────────────────────────────────────────────────┤
│  - Receive events via WebSocket                         │
│  - Store in ProctoringEvents collection                 │
│  - Upload snapshots to S3                               │
│  - Alert on critical violations                         │
│  - Generate post-interview reports                      │
└─────────────────────────────────────────────────────────┘
```

### Privacy & Consent
1. **Explicit Consent Required** before any monitoring
2. **Clear Privacy Notice** with data usage details
3. **Opt-out Option** with manual review fallback
4. **Consent Logging** with timestamp and version
5. **Data Retention** per company policy
6. **Right to Access** candidate can view their data
7. **Right to Delete** upon request

## Security

### Application Security
- ✅ HTTPS everywhere (TLS 1.2+)
- ✅ JWT with short expiry (7 days) + refresh tokens (30 days)
- ✅ Role-Based Access Control (RBAC)
- ✅ Rate limiting (100 req/15min per IP)
- ✅ Input validation & sanitization
- ✅ SQL injection prevention (MongoDB parameterized queries)
- ✅ XSS protection (helmet.js)
- ✅ CORS configuration
- ✅ Secrets in environment variables
- ✅ Encrypted storage for sensitive data

### Data Security
- ✅ Password hashing (bcrypt, 10 rounds)
- ✅ Encryption at rest (MongoDB encryption)
- ✅ Encryption in transit (TLS)
- ✅ Secure token storage (httpOnly cookies or localStorage with caution)
- ✅ Regular backups with encryption
- ✅ Audit logging for all critical operations

## Scalability

### Horizontal Scaling
```
┌─────────────────────────────────────────────────────────┐
│                   Load Balancer (NGINX/ALB)             │
└──────────────┬──────────────────────────────────────────┘
               │
     ┌─────────┴─────────┬─────────────┐
     ▼                   ▼             ▼
┌─────────┐         ┌─────────┐   ┌─────────┐
│ Node 1  │         │ Node 2  │   │ Node N  │
│ Express │         │ Express │   │ Express │
└────┬────┘         └────┬────┘   └────┬────┘
     │                   │             │
     └─────────┬─────────┴─────────────┘
               ▼
     ┌─────────────────┐
     │  MongoDB Cluster│
     │  (Replica Set)  │
     └─────────────────┘
               ▼
     ┌─────────────────┐
     │  Redis Cluster  │
     └─────────────────┘
```

### Performance Optimizations
- Database indexing on frequently queried fields
- Redis caching for frequently accessed data
- CDN for static assets
- Image optimization & lazy loading
- Query result pagination
- Background jobs for heavy operations
- Connection pooling
- Compression middleware

### Monitoring & Observability
- Application logs (Winston + centralized logging)
- Error tracking (Sentry)
- Performance monitoring (APM)
- Database monitoring
- Alert on failures/thresholds
- Health check endpoints

---

**Last Updated**: December 2024  
**Version**: 1.0.0
