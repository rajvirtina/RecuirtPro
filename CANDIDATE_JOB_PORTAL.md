# Candidate Job Portal - Implementation Guide

## Overview

This document describes the new LinkedIn-style candidate job browsing and application interface implemented for RecuirtPro.

## Features Implemented

### 1. Candidate Job Listing Page (`/candidate/jobs`)

**Location:** `frontend/src/pages/jobs/CandidateJobs.tsx`

**Features:**
- LinkedIn-style card-based job listing layout
- Split-screen interface: job list (left) + job details (right)
- Real-time job search with pagination
- Visual badges for work mode (Remote/Onsite/Hybrid) and job type (Full-time/Part-time/Contract/Internship)
- Company branding with logo display or gradient fallback
- "Posted X days/weeks ago" timestamp
- "Actively Hiring" and "Verified Employer" badges
- Mobile-responsive design

**Job Card Information:**
- Job title
- Company name with logo
- Location
- Work mode badge (color-coded)
- Job type badge (color-coded)
- Experience range
- Time posted
- Skills required

**Job Details Panel:**
- Full job description
- Company information with link to company jobs page
- Apply Now button (navigates to application form)
- Skills required (tags)
- Additional metadata (experience, job type)

### 2. Job Application Page (`/jobs/:id/apply`)

**Location:** `frontend/src/pages/jobs/ApplyJob.tsx`

**Features:**
- Clean, focused application form
- Job summary card at top
- Resume/CV file upload (drag & drop support)
  - Accepts PDF, DOC, DOCX formats
  - Max file size: 5MB
  - File preview with delete option
- Cover letter text area (required, min 100 characters)
- Expected salary input (optional, INR currency)
- Notice period dropdown (optional)
- Form validation with error messages
- Success screen after submission
- Privacy notice at bottom
- Back to jobs navigation

**Validation:**
- Resume required
- Cover letter required (minimum length recommended)
- File type validation (PDF/Word only)
- File size validation (max 5MB)
- Duplicate application prevention (backend)

### 3. Navigation Updates

**Updated Files:**
- `frontend/src/App.tsx` - Added routes for candidate jobs and application
- `frontend/src/components/layout/Layout.tsx` - Updated candidate navigation menu
- `frontend/src/pages/Dashboard.tsx` - Added "Browse Jobs" CTA button for candidates

**New Routes:**
- `/candidate/jobs` - Main candidate job listing page
- `/jobs/:id/apply` - Job application form

**Navigation Menu (Candidates):**
- Dashboard
- **Browse Jobs** (new, points to `/candidate/jobs`)
- My Applications
- Interviews
- Profile

## Backend API Integration

### GET /api/v1/jobs
- Fetches all published jobs
- Supports pagination (`page`, `limit` parameters)
- Filtered by `status=published` for candidates
- Returns job with populated company information

**Response Structure:**
```typescript
{
  data: Job[],
  pagination: {
    page: number,
    limit: number,
    totalPages: number,
    total: number
  }
}
```

### GET /api/v1/jobs/:id
- Fetches single job by ID
- Returns full job details with company information
- Used for job detail view and application page

### POST /api/v1/applications
- Submits job application
- Requires authentication (candidate role)
- Supports multipart/form-data for file upload

**Request Body:**
```typescript
{
  jobId: string,           // Required
  coverLetter: string,     // Required
  resume: File,            // Required (multipart)
  expectedSalary: number,  // Optional
  noticePeriod: string     // Optional
}
```

**Features:**
- File upload with multer middleware
- Duplicate application check
- Job status validation (only published jobs)
- Auto-increment application count on job
- Creates/updates candidate profile

## User Experience Flow

### Candidate Journey:

1. **Login** → Candidate dashboard
2. **Click "Browse Jobs"** → `/candidate/jobs`
3. **Browse job cards** in left panel
4. **Click any job card** → Job details appear in right panel
5. **Read job description** and requirements
6. **Click "Apply Now"** → `/jobs/:id/apply`
7. **Fill application form**:
   - Upload resume
   - Write cover letter
   - Add expected salary (optional)
   - Select notice period (optional)
8. **Submit application** → Success screen → Redirect to job listing
9. **View application status** → My Applications page

### Data Privacy & Security:

**Candidate Restrictions (What Candidates DON'T See):**
- ❌ Internal salary slabs used by HR
- ❌ Number of applicants
- ❌ Internal hiring status (shortlisted, rejected)
- ❌ Internal notes or scoring
- ❌ Applicant comparisons
- ❌ Candidate pipeline stages

**Candidate Visibility (What Candidates CAN See):**
- ✅ Job title, description, requirements
- ✅ Company name and branding
- ✅ Location and work mode
- ✅ Experience range
- ✅ Skills required
- ✅ Posted date
- ✅ Their own application status

## Styling & Design

### Design System:
- **Primary Color:** Indigo (600-700 range)
- **Secondary Colors:** Blue, Purple, Green, Yellow, Orange (for badges)
- **Typography:** System fonts, responsive sizing
- **Spacing:** Consistent padding/margin scale
- **Shadows:** Subtle shadow-sm for cards
- **Borders:** Light gray borders
- **Rounded Corners:** Medium (rounded-lg)

### Component Patterns:
- **Job Cards:** White background, hover effect, selected state (indigo border)
- **Badges:** Colored backgrounds with matching text, rounded-full shape
- **Buttons:** Solid primary (indigo), outline secondary
- **Form Inputs:** Full-width, consistent padding, focus ring
- **Upload Area:** Dashed border, hover state, drag-and-drop ready
- **Icons:** Lucide React icons throughout

### Responsive Breakpoints:
- Mobile: < 768px (single column, stacked layout)
- Tablet: 768px - 1024px (2 columns)
- Desktop: > 1024px (3-column grid with sidebar)

## File Structure

```
frontend/src/
├── pages/
│   ├── jobs/
│   │   ├── CandidateJobs.tsx     [NEW] - Main job listing for candidates
│   │   ├── ApplyJob.tsx          [NEW] - Application form
│   │   ├── Jobs.tsx              [EXISTING] - HR/employer job management
│   │   ├── JobDetail.tsx         [EXISTING] - Job detail page
│   │   ├── JobForm.tsx           [EXISTING] - Create/edit jobs
│   │   └── CompanyJobs.tsx       [EXISTING] - Public company job page
│   └── Dashboard.tsx             [MODIFIED] - Added browse jobs CTA
├── components/
│   └── layout/
│       └── Layout.tsx            [MODIFIED] - Updated candidate navigation
└── App.tsx                       [MODIFIED] - Added new routes
```

## Testing Checklist

### Functional Testing:
- [ ] Job listing loads with all published jobs
- [ ] Job cards display correct information
- [ ] Clicking job card shows details in right panel
- [ ] Apply button navigates to application form
- [ ] Resume upload works (drag & drop and click)
- [ ] File validation works (type and size)
- [ ] Form validation displays errors
- [ ] Application submission succeeds
- [ ] Success screen appears and redirects
- [ ] Duplicate application is prevented
- [ ] Back navigation works correctly

### Visual Testing:
- [ ] Layout is responsive on mobile/tablet/desktop
- [ ] Job cards have hover effects
- [ ] Selected job card is highlighted
- [ ] Badges display with correct colors
- [ ] Company logos display or fallback gradient shows
- [ ] Icons render correctly
- [ ] Form inputs have proper focus states
- [ ] Error messages are visible and clear

### Role-Based Testing:
- [ ] Candidates see only published jobs
- [ ] Candidates cannot see internal HR data
- [ ] Non-candidates are redirected appropriately
- [ ] Authentication is required for application submission
- [ ] Only candidates can submit applications

### Edge Cases:
- [ ] Empty job list displays appropriate message
- [ ] Network errors are handled gracefully
- [ ] Large file upload fails with clear error
- [ ] Invalid file types are rejected
- [ ] Very long job descriptions render properly
- [ ] Multiple pagination pages work correctly

## Future Enhancements

### Phase 2 (Planned):
- [ ] Job search and filtering (keywords, location, salary range)
- [ ] Job bookmarking/save for later
- [ ] Job recommendations based on profile
- [ ] Application draft save
- [ ] Resume parser integration
- [ ] One-click apply (pre-filled from profile)
- [ ] Email notifications for new jobs
- [ ] Job alerts based on preferences

### Phase 3 (Future):
- [ ] Company reviews and ratings
- [ ] Salary insights and comparisons
- [ ] Interview preparation resources
- [ ] Job match percentage
- [ ] Application tracking timeline
- [ ] Chat with recruiter
- [ ] Video introduction upload

## API Endpoints Summary

| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| GET | `/api/v1/jobs` | Optional | Any | List all published jobs |
| GET | `/api/v1/jobs/:id` | Optional | Any | Get job details |
| POST | `/api/v1/applications` | Required | Candidate | Submit application |
| GET | `/api/v1/applications` | Required | Candidate/HR | List applications |
| GET | `/api/v1/applications/:id` | Required | Candidate/HR | Get application detail |

## Configuration

### Environment Variables:
None required specifically for this feature. Uses existing configuration:
- `VITE_API_URL` - Backend API base URL
- JWT token for authentication

### File Upload Settings (Backend):
- Upload directory: `backend/uploads/resumes/`
- Max file size: 5MB
- Allowed formats: PDF, DOC, DOCX
- File naming: UUID + original extension

## Deployment Notes

1. **Build Frontend:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Ensure Upload Directory Exists:**
   ```bash
   mkdir -p backend/uploads/resumes
   ```

3. **File Permissions:**
   - Ensure backend has write access to upload directory
   - Set proper permissions: `chmod 755 backend/uploads`

4. **CORS Configuration:**
   - Ensure frontend domain is allowed in backend CORS settings
   - File uploads require `multipart/form-data` content type

## Support

For issues or questions:
- Check backend logs: `backend/logs/application-YYYY-MM-DD.log`
- Check browser console for frontend errors
- Verify JWT token is being sent in Authorization header
- Confirm file upload directory permissions

---

**Last Updated:** December 31, 2025  
**Version:** 1.0  
**Author:** GitHub Copilot
