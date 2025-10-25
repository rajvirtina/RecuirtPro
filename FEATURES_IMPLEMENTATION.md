# New Features Implementation Summary

## Overview
Successfully implemented 4 major features for company-specific candidate management:

1. ✅ Company-Specific Job Visibility
2. ✅ Candidate Invitation System
3. ✅ Resume Upload Support
4. ✅ HR Applicant View with Resume Download

---

## Feature 1: Company-Specific Job Visibility

### Backend Changes:

**File: `backend/src/controllers/jobController.ts`**
- Updated `getJobs()` function to filter by `companyId` when `companySpecific=true` query parameter is present
- HR/Employer/Admin can request company-specific jobs to see only their company's postings
- Candidates continue to see all published jobs (public job board)

### Usage:
```
GET /api/v1/jobs?companySpecific=true
```

---

## Feature 2: Candidate Invitation System

### Backend Changes:

**New Model: `backend/src/models/Invitation.ts`**
- Fields: email, companyId, invitedBy, token, role, status, expiresAt, acceptedAt
- Statuses: pending, accepted, expired
- Unique token for registration link

**New Controller: `backend/src/controllers/invitationController.ts`**
- `sendCandidateInvitation()` - HR sends invitation email with unique token
- `verifyInvitationToken()` - Validate token before registration
- `getInvitations()` - List all invitations (paginated, filterable)
- `resendInvitation()` - Resend expired/pending invitations

**New Routes: `backend/src/routes/invitations.ts`**
- POST `/api/v1/invitations/send` - Send invitation (HR/Employer/Admin only)
- GET `/api/v1/invitations/verify/:token` - Verify token (Public)
- GET `/api/v1/invitations` - List invitations (HR/Employer/Admin only)
- POST `/api/v1/invitations/:id/resend` - Resend invitation (HR/Employer/Admin only)

**Updated: `backend/src/controllers/authController.ts`**
- Modified `register()` function to handle `invitationToken` parameter
- Validates invitation before registration
- Associates user with company from invitation
- Marks invitation as accepted after successful registration

**Updated: `backend/src/app.ts`**
- Added invitation routes to app

### Usage Flow:
1. HR sends invitation: `POST /api/v1/invitations/send` with `{ email: "candidate@email.com" }`
2. Candidate receives email with link: `http://localhost:5173/register?token=abc123`
3. Frontend verifies token: `GET /api/v1/invitations/verify/abc123`
4. Candidate registers: `POST /api/v1/auth/register` with `{ ..., invitationToken: "abc123" }`

---

## Feature 3: Resume Upload Support

### Backend Changes:

**New Middleware: `backend/src/middleware/upload.ts`**
- Multer configuration for file uploads
- Accepts: PDF, DOC, DOCX files
- Max size: 5MB
- Storage: `uploads/resumes/` directory
- Filename format: `{originalname}-{timestamp}-{userId}.{ext}`

**Updated Controller: `backend/src/controllers/applicationController.ts`**
- Modified `submitApplication()` to handle file uploads via `req.file`
- Auto-generates resume URL from uploaded file
- Falls back to `resumeUrl` in body if no file uploaded

**Updated Routes: `backend/src/routes/applications.ts`**
- Added `uploadResume.single('resume')` middleware to POST `/api/v1/applications`
- Added `handleUploadError` middleware for multer error handling

**Updated: `backend/src/app.ts`**
- Added static file serving: `app.use('/uploads', express.static('uploads'))`

### Usage:
```javascript
// Frontend form submission
const formData = new FormData();
formData.append('jobId', jobId);
formData.append('coverLetter', coverLetter);
formData.append('resume', file); // File object from input
formData.append('expectedSalary', salary);

axios.post('/api/v1/applications', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
```

---

## Feature 4: HR View Applicants with Resume Download

### Backend Changes:

**Updated Controller: `backend/src/controllers/applicationController.ts`**
- Added `downloadResume()` function
- Authorization: Application owner, Company HR, or Admin
- Returns file download with proper error handling

**Updated Routes: `backend/src/routes/applications.ts`**
- Added GET `/api/v1/applications/:id/resume` route

**Existing Functionality:**
- `getApplications()` already filters by companyId for HR/Employer
- Returns applications with candidate details and resume URLs
- Supports pagination and filtering by status/job

### Usage:
```
// Get all applicants for company
GET /api/v1/applications

// Download specific resume
GET /api/v1/applications/:applicationId/resume
```

---

## Dependencies Installed

```bash
npm install multer @types/multer
```

---

## Environment Variables (if needed)

Add to `.env`:
```
FRONTEND_URL=http://localhost:5173
```

---

## Folder Structure Created

```
backend/
  uploads/
    resumes/    # Auto-created by middleware
```

---

## Testing Endpoints

### 1. Send Invitation
```bash
POST http://localhost:5000/api/v1/invitations/send
Authorization: Bearer {HR_TOKEN}
Content-Type: application/json

{
  "email": "candidate@example.com",
  "jobId": "optional-job-id"
}
```

### 2. Verify Invitation
```bash
GET http://localhost:5000/api/v1/invitations/verify/{token}
```

### 3. Register with Invitation
```bash
POST http://localhost:5000/api/v1/auth/register
Content-Type: application/json

{
  "email": "candidate@example.com",
  "password": "SecurePass123",
  "firstName": "John",
  "lastName": "Doe",
  "invitationToken": "abc123..."
}
```

### 4. Submit Application with Resume
```bash
POST http://localhost:5000/api/v1/applications
Authorization: Bearer {CANDIDATE_TOKEN}
Content-Type: multipart/form-data

resume: {file}
jobId: {jobId}
coverLetter: "..."
expectedSalary: 50000
```

### 5. Download Resume
```bash
GET http://localhost:5000/api/v1/applications/{applicationId}/resume
Authorization: Bearer {HR_TOKEN}
```

### 6. Get Company-Specific Jobs
```bash
GET http://localhost:5000/api/v1/jobs?companySpecific=true
Authorization: Bearer {HR_TOKEN}
```

---

## Frontend Implementation Needed

### 1. Invitation Management Page (HR)
- List invitations with status
- Send new invitation form
- Resend invitation button
- View invitation details

### 2. Registration Page Updates
- Detect `?token=` in URL
- Verify token on page load
- Pre-fill email from invitation
- Show company name being registered for

### 3. Application Form Updates
- Add file upload input for resume
- Accept PDF, DOC, DOCX formats
- Show file size/type validation
- Display upload progress

### 4. Applicants Table (HR)
- Display all applications with candidate details
- Show resume indicator (uploaded/not uploaded)
- Add "Download Resume" button
- Filter by job, status

### 5. Job Listing Updates
- Add toggle for HR: "Show My Company Jobs Only"
- Filter jobs by companyId when enabled

---

## Security Considerations

1. **Invitation Tokens**: Unique, crypto-random, expire in 7 days
2. **File Upload**: Validated file types, size limits, sanitized filenames
3. **Resume Access**: Authorization checks before download
4. **Company Isolation**: Jobs and applications filtered by companyId

---

## Database Indexes

Invitation model already includes:
- `{ email: 1, companyId: 1 }` - Unique constraint
- `{ token: 1 }` - Unique
- `{ status: 1, expiresAt: 1 }` - Query optimization

---

## Next Steps (Frontend)

1. Create `InvitationManagement` component for HR
2. Update `Register` page to handle invitation tokens
3. Add file upload to `ApplicationForm` component
4. Create `ApplicantsList` component with resume downloads
5. Add company filter toggle to jobs page for HR

---

## API Documentation

All endpoints are documented with Swagger JSDoc.
Access at: `http://localhost:5000/api-docs`
