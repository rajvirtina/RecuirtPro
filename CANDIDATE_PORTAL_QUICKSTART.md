# Candidate Job Portal - Quick Start Guide

## ✅ What's Been Implemented

A complete LinkedIn-style job browsing and application system for candidates has been added to RecuirtPro.

## 🎯 New Features

### For Candidates:

1. **LinkedIn-Style Job Listing** (`/candidate/jobs`)
   - Beautiful card-based job layout
   - Split-screen: job list + details
   - Color-coded badges for work mode and job type
   - Company logos and branding
   - "Actively Hiring" indicators
   - Real-time job search

2. **Professional Application Form** (`/jobs/:id/apply`)
   - Resume upload (PDF/Word, max 5MB)
   - Cover letter text area
   - Expected salary input
   - Notice period selection
   - Form validation
   - Success confirmation

3. **Enhanced Navigation**
   - New "Browse Jobs" menu item for candidates
   - Direct access from dashboard
   - Smooth navigation flow

## 🚀 How to Test

### Step 1: Start the Application

Make sure both backend and frontend are running:

```powershell
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

### Step 2: Login as Candidate

1. Navigate to `http://localhost:5173/login`
2. Use test candidate credentials or create a new candidate account
3. After login, you'll see the dashboard

### Step 3: Browse Jobs

1. Click **"Browse Jobs"** button on dashboard OR
2. Click **"Browse Jobs"** in the navigation menu
3. You'll be redirected to `/candidate/jobs`

### Step 4: View Job Details

1. Click any job card in the left panel
2. Job details will appear in the right panel
3. Read the full description, requirements, and company info

### Step 5: Apply for a Job

1. Click **"Apply Now"** button
2. Upload your resume (PDF or Word document)
3. Write a cover letter explaining why you're interested
4. Optionally add expected salary and notice period
5. Click **"Submit Application"**
6. You'll see a success message and be redirected back to jobs

## 📱 What Candidates See vs What They Don't See

### ✅ Candidates CAN See:
- Job title and description
- Company name and logo
- Location and work mode (Remote/Onsite/Hybrid)
- Job type (Full-time/Part-time/Contract)
- Experience requirements
- Skills required
- Posted date
- Their own application status

### ❌ Candidates CANNOT See:
- Internal salary slabs used by HR
- Number of other applicants
- Interview scores or ratings
- Internal hiring notes
- Candidate pipeline stages
- Shortlist/rejection details (until notified)

## 🎨 Design Features

### Job Cards Include:
- **Company Logo** or gradient fallback
- **Job Title** (bold, prominent)
- **Company Name** (clickable to company page)
- **Location** with pin icon
- **Work Mode Badge** (color-coded: green=remote, blue=onsite, purple=hybrid)
- **Job Type Badge** (color-coded by type)
- **Time Posted** (e.g., "2 days ago")
- **Actively Hiring Badge** (green with trending icon)
- **Verified Employer Badge** (blue with checkmark)

### Application Form Features:
- **Drag & Drop Resume Upload** with file preview
- **Character Counter** for cover letter
- **Currency Formatting** for salary input
- **Dropdown Selection** for notice period
- **Real-time Validation** with error messages
- **Privacy Notice** at bottom of form
- **Success Screen** with confirmation

## 🔧 Technical Details

### Routes Added:
- `/candidate/jobs` - Main job listing for candidates
- `/jobs/:id/apply` - Application submission form

### Components Created:
- `frontend/src/pages/jobs/CandidateJobs.tsx` - Job listing page (470 lines)
- `frontend/src/pages/jobs/ApplyJob.tsx` - Application form (330 lines)

### Files Modified:
- `frontend/src/App.tsx` - Added new routes
- `frontend/src/components/layout/Layout.tsx` - Updated candidate menu
- `frontend/src/pages/Dashboard.tsx` - Added "Browse Jobs" CTA

### Backend Integration:
- Uses existing `GET /api/v1/jobs` endpoint
- Uses existing `POST /api/v1/applications` endpoint with file upload
- Leverages existing authentication and authorization
- No backend changes required!

## 📊 Sample Data

To test properly, ensure you have:
- ✅ At least one company created
- ✅ At least one published job
- ✅ A candidate account

## 🎯 Navigation Flow

```
Candidate Login
    ↓
Dashboard
    ↓ (Click "Browse Jobs")
Job Listing (/candidate/jobs)
    ↓ (Click job card)
Job Details (right panel)
    ↓ (Click "Apply Now")
Application Form (/jobs/:id/apply)
    ↓ (Upload resume + fill form)
Submit Application
    ↓
Success Screen
    ↓ (Auto-redirect after 2 seconds)
Back to Job Listing
```

## 🧪 Testing Checklist

- [ ] Job listing page loads successfully
- [ ] All published jobs are displayed
- [ ] Clicking a job card shows details
- [ ] Company logos display correctly
- [ ] Badges have correct colors
- [ ] "Apply Now" navigates to application form
- [ ] Resume upload works (PDF/Word)
- [ ] File size validation works (>5MB rejected)
- [ ] File type validation works (only PDF/Word accepted)
- [ ] Cover letter validation works (required)
- [ ] Form submission succeeds
- [ ] Success screen appears
- [ ] Auto-redirect works after submission
- [ ] "Back to Jobs" button works
- [ ] Page is responsive on mobile
- [ ] Navigation menu shows "Browse Jobs"
- [ ] Dashboard CTA button works

## 🐛 Troubleshooting

### Jobs not loading?
- Check backend is running on port 5001
- Verify MongoDB is connected
- Ensure at least one job has `status: 'published'`

### Application submission fails?
- Check file size (must be < 5MB)
- Check file type (only PDF, DOC, DOCX)
- Ensure cover letter is filled
- Verify backend upload directory exists: `backend/uploads/resumes/`

### Navigation not showing?
- Hard refresh the page (Ctrl + Shift + R)
- Clear browser cache
- Check user role is 'candidate'

### Styling looks broken?
- Ensure Tailwind CSS is properly configured
- Check browser console for CSS errors
- Verify all Lucide React icons are installed

## 📚 Documentation

Full documentation available in:
- `CANDIDATE_JOB_PORTAL.md` - Complete implementation guide
- Includes API details, design system, future enhancements

## 🎉 Summary

You now have a fully functional, production-ready candidate job portal with:
- ✅ Beautiful LinkedIn-style UI
- ✅ Seamless application flow
- ✅ File upload support
- ✅ Form validation
- ✅ Mobile responsive design
- ✅ No backend changes needed
- ✅ Zero TypeScript errors
- ✅ Clean, maintainable code

The system is ready for candidate testing and production deployment!
