# RecruiterPro - End-to-End Testing Plan

## Test Environment Setup

### Prerequisites Checklist
- ✅ MongoDB running on localhost:27017
- ✅ Backend server running on http://localhost:5001
- ✅ Frontend running on http://localhost:3000
- ✅ SKIP_EMAIL=true in .env (development mode)

### Quick Start
```bash
# Terminal 1: Start Backend
cd E:\RecuirtPro\backend
npm run dev

# Terminal 2: Start Frontend
cd E:\RecuirtPro\frontend
npm run dev

# Terminal 3: MongoDB (if not running as service)
mongod --dbpath=C:\data\db
```

---

## End-to-End Test Scenarios

### Scenario 1: Admin Login & Dashboard

#### Test Steps:
1. **Open Browser**: Navigate to http://localhost:3000
2. **Login as Admin**:
   - Email: `admin@company.com`
   - Password: (default admin password)
   - Click "Login"

#### Expected Results:
- ✅ Successful login
- ✅ Redirected to Admin Dashboard
- ✅ Dashboard shows statistics:
  - Total Jobs
  - Total Applications
  - Active Candidates
  - Pending Interviews

#### API Endpoints Tested:
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/admin/stats`

---

### Scenario 2: Create HR User (Admin Flow)

#### Test Steps:
1. **Navigate to HR Management**: Click "HR Users" in sidebar
2. **Click "Invite HR User"** button
3. **Fill Form**:
   ```
   First Name: John
   Last Name: Smith
   Email: john.smith@company.com
   Role: HR Manager
   Department: Engineering
   Phone: +1234567890
   ```
4. **Submit**: Click "Send Invitation"

#### Expected Results:
- ✅ Success message: "HR user invited successfully"
- ✅ New user appears in HR Users list
- ✅ Status: "Pending Verification"
- ✅ Console log shows: `[DEV MODE] Email would be sent to john.smith@company.com`
- ✅ Console log contains invitation URL

#### API Endpoints Tested:
- `POST /api/v1/admin/invite-hr`
- `GET /api/v1/admin/hr-users`

#### Audit Log Verification:
```bash
# Check MongoDB
db.auditlogs.find({ action: "CREATE", resource: "User" }).sort({ timestamp: -1 }).limit(1)
```

Expected:
```json
{
  "description": "Invited HR user: john.smith@company.com (hr) to department: Engineering",
  "action": "CREATE",
  "resource": "User"
}
```

---

### Scenario 3: HR User Registration (Complete Setup)

#### Test Steps:
1. **Get Invitation URL from Console**:
   - Look for log: `[DEV MODE] Email would be sent to...`
   - Copy the `invitationUrl` value
   - Example: `http://localhost:3000/complete-registration?token=abc123...`

2. **Open Invitation URL** in browser (can use incognito/private mode)

3. **Complete Registration Form**:
   ```
   Password: Test@12345
   Confirm Password: Test@12345
   ```
4. **Submit**: Click "Complete Registration"

#### Expected Results:
- ✅ Success message: "Registration completed successfully"
- ✅ Redirected to login page
- ✅ User can now login with email and password

#### API Endpoints Tested:
- `POST /api/v1/hr/complete-registration`

---

### Scenario 4: HR User Login & Dashboard

#### Test Steps:
1. **Login as HR User**:
   - Email: `john.smith@company.com`
   - Password: `Test@12345`
   - Click "Login"

#### Expected Results:
- ✅ Successful login
- ✅ Redirected to HR Dashboard
- ✅ Dashboard shows:
  - My Jobs
  - Recent Applications
  - Upcoming Interviews
  - Quick Actions

#### API Endpoints Tested:
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/dashboard/employer`

---

### Scenario 5: Create Job Posting (HR Flow)

#### Test Steps:
1. **Navigate to Jobs**: Click "Jobs" → "Post New Job"
2. **Fill Job Details**:
   ```
   Job Title: Senior Software Engineer
   Department: Engineering
   Location: New York, NY
   Employment Type: Full-time
   Experience Level: Senior
   Salary Range: $120,000 - $160,000
   
   Description:
   We are seeking an experienced software engineer...
   
   Required Skills:
   - JavaScript, React, Node.js
   - 5+ years experience
   - BS in Computer Science
   
   Responsibilities:
   - Design and implement features
   - Code reviews
   - Mentor junior developers
   ```

3. **Configure Interview Process**:
   ```
   Round 1: Technical Screening (Video, 45 min)
   Round 2: System Design (Video, 60 min)
   Round 3: Final Interview (In-person, 30 min)
   ```

4. **Enable Proctoring**:
   - ☑ Enable Proctoring
   - ☑ Record Audio
   - ☑ Record Video

5. **Publish**: Click "Publish Job"

#### Expected Results:
- ✅ Success message: "Job posted successfully"
- ✅ Job appears in "Active Jobs" list
- ✅ Job is visible to candidates
- ✅ Job status: "Active"

#### API Endpoints Tested:
- `POST /api/v1/jobs`
- `GET /api/v1/jobs`

---

### Scenario 6: Candidate Registration

#### Test Steps:
1. **Open New Browser/Incognito**: http://localhost:3000
2. **Click "Sign Up"**
3. **Select Role**: "Candidate"
4. **Fill Registration Form**:
   ```
   First Name: Jane
   Last Name: Doe
   Email: jane.doe@example.com
   Password: Candidate@123
   Confirm Password: Candidate@123
   ```
5. **Accept Terms**: Check "I agree to Terms of Service"
6. **Submit**: Click "Sign Up"

#### Expected Results:
- ✅ Account created successfully
- ✅ Consent modal appears (if first time)
- ✅ User can accept/decline consent for:
  - Data Processing
  - Interview Recording
  - Candidate Tracking
- ✅ Redirected to candidate dashboard

#### API Endpoints Tested:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`

#### Database Verification:
```bash
# Check user created
db.users.findOne({ email: "jane.doe@example.com" })

# Check consent log created
db.consentlogs.find({ userEmail: "jane.doe@example.com" })
```

---

### Scenario 7: Candidate Profile Setup

#### Test Steps:
1. **Navigate to Profile**: Click "My Profile"
2. **Upload Resume**: 
   - Click "Upload Resume"
   - Select PDF file
   - Wait for upload

3. **Complete Profile**:
   ```
   Phone: +1234567890
   Location: San Francisco, CA
   LinkedIn: https://linkedin.com/in/janedoe
   
   Skills:
   - JavaScript (Expert, 5 years)
   - React (Advanced, 4 years)
   - Node.js (Advanced, 4 years)
   - Python (Intermediate, 2 years)
   
   Work Experience:
   Company: Tech Corp
   Title: Software Engineer
   Duration: 2019 - Present
   Description: Developed full-stack applications...
   
   Education:
   Degree: BS Computer Science
   University: MIT
   Year: 2019
   ```

4. **Save Profile**: Click "Save Changes"

#### Expected Results:
- ✅ Profile updated successfully
- ✅ Resume uploaded and visible
- ✅ Profile completion: 100%
- ✅ Skills displayed with proficiency levels

#### API Endpoints Tested:
- `PUT /api/v1/auth/profile`
- `POST /api/v1/upload/resume` (if file upload implemented)

---

### Scenario 8: Browse & Apply for Job (Candidate Flow)

#### Test Steps:
1. **Navigate to Jobs**: Click "Browse Jobs"
2. **Search/Filter**:
   - Search: "Software Engineer"
   - Filter by: Full-time, Senior level
   - Location: New York

3. **View Job Details**: Click on "Senior Software Engineer"
4. **Review Job**: 
   - Read description
   - Check requirements
   - Review salary range

5. **Apply**:
   - Click "Apply Now"
   - Review pre-filled information
   - Add cover letter (optional):
     ```
     I am excited to apply for this position...
     ```
   - Click "Submit Application"

#### Expected Results:
- ✅ Success message: "Application submitted successfully"
- ✅ Application ID displayed
- ✅ Application appears in "My Applications"
- ✅ Status: "Submitted"
- ✅ Email notification logged (dev mode)

#### API Endpoints Tested:
- `GET /api/v1/jobs`
- `GET /api/v1/jobs/:id`
- `POST /api/v1/applications`
- `GET /api/v1/applications`

---

### Scenario 9: Review Application (HR Flow)

#### Test Steps:
1. **Login as HR**: john.smith@company.com
2. **Navigate to Applications**: Click "Applications"
3. **Filter**: Select job "Senior Software Engineer"
4. **View Application**: Click on Jane Doe's application
5. **Review**:
   - Read resume
   - Review cover letter
   - Check skills match
   - View profile

6. **Screen Application**:
   - Rating: 4/5 stars
   - Notes: "Strong React experience, good fit for team"
   - Decision: "Shortlist"

7. **Save**: Click "Update Status"

#### Expected Results:
- ✅ Application status updated to "Shortlisted"
- ✅ Notes saved
- ✅ Candidate notified (email logged)
- ✅ Application moves to "Shortlisted" tab

#### API Endpoints Tested:
- `GET /api/v1/applications`
- `GET /api/v1/applications/:id`
- `PUT /api/v1/applications/:id`

---

### Scenario 10: Schedule Interview (HR Flow)

#### Test Steps:
1. **From Application**: Click "Schedule Interview"
2. **Select Interview Round**: Round 1 - Technical Screening
3. **Set Details**:
   ```
   Date: Tomorrow
   Time: 2:00 PM
   Duration: 45 minutes
   Interviewer: John Smith
   Format: Video
   Meeting Link: (auto-generated)
   ```

4. **Add Message** (optional):
   ```
   Looking forward to discussing your experience with React!
   ```

5. **Send Invitation**: Click "Schedule Interview"

#### Expected Results:
- ✅ Interview scheduled successfully
- ✅ Calendar event created
- ✅ Interview appears in "Upcoming Interviews"
- ✅ Email notification logged
- ✅ Status: "Interview Scheduled"

#### API Endpoints Tested:
- `POST /api/v1/interviews`
- `GET /api/v1/interviews`

#### Database Verification:
```bash
db.interviews.find({ candidateId: ObjectId("...") })
```

---

### Scenario 11: Candidate Interview Preparation

#### Test Steps:
1. **Login as Candidate**: jane.doe@example.com
2. **Navigate to Interviews**: Click "My Interviews"
3. **View Interview Details**:
   - Date & Time
   - Interviewer info
   - Job details
   - Interview format

4. **Accept Interview**: Click "Accept"
5. **Add to Calendar**: Click "Add to Calendar"
6. **Pre-interview Check**:
   - Click "Test Camera & Microphone"
   - Grant permissions
   - Verify video/audio working

#### Expected Results:
- ✅ Interview status: "Accepted"
- ✅ Calendar event added
- ✅ Camera/mic test successful
- ✅ "Join Interview" button appears 15 min before

#### API Endpoints Tested:
- `GET /api/v1/interviews`
- `PUT /api/v1/interviews/:id/accept`

---

### Scenario 12: Join Interview with Proctoring (Candidate Flow)

#### Test Steps:
1. **At Interview Time**: Click "Join Interview"
2. **Proctoring Check**:
   - Camera check: ✓ Working
   - Microphone check: ✓ Working
   - Internet speed: ✓ Stable
   - Lighting: ✓ Good

3. **Accept Consent**:
   - ☑ I consent to recording
   - ☑ I consent to monitoring

4. **Click**: "Verify & Continue"
5. **Enter Interview Room**:
   - Video feed displays
   - Interviewer joins
   - Interview begins

#### Expected Results:
- ✅ Proctoring checks pass
- ✅ Consent recorded in database
- ✅ Enter interview room
- ✅ Recording starts (if enabled)
- ✅ Proctoring events logged

#### API Endpoints Tested:
- `GET /api/v1/interviews/:id/proctoring-check`
- `POST /api/v1/proctoring/events`
- `POST /api/v1/consent/record`

#### Database Verification:
```bash
# Check proctoring events
db.proctoringevents.find({ interviewId: ObjectId("...") })

# Check consent
db.consentlogs.find({ 
  userEmail: "jane.doe@example.com", 
  consentType: "recording" 
})
```

---

### Scenario 13: Conduct Interview (HR/Interviewer Flow)

#### Test Steps:
1. **Join as Interviewer**: Click "Join Interview"
2. **During Interview**:
   - Ask questions
   - Take notes
   - Observe candidate responses

3. **End Interview**: Click "End Interview"
4. **Submit Feedback**:
   ```
   Overall Rating: 4/5
   
   Technical Skills: 4/5
   Communication: 5/5
   Problem Solving: 4/5
   
   Strengths:
   - Excellent React knowledge
   - Clear communicator
   - Good problem-solving approach
   
   Concerns:
   - Limited Node.js backend experience
   
   Recommendation: Move to Round 2
   ```

5. **Save Feedback**: Click "Submit"

#### Expected Results:
- ✅ Interview marked as "Completed"
- ✅ Feedback saved
- ✅ Recording available for review
- ✅ Transcript generated (if enabled)
- ✅ Candidate status updated

#### API Endpoints Tested:
- `PUT /api/v1/interviews/:id/feedback`
- `GET /api/v1/interviews/:id/recording`

---

### Scenario 14: Make Hiring Decision (HR Flow)

#### Test Steps:
1. **Review All Interview Feedback**: Navigate to candidate
2. **Team Calibration**:
   - Review all round feedback
   - Discuss with team
   - Make final decision

3. **Send Job Offer**:
   - Click "Send Offer"
   - Fill offer details:
     ```
     Position: Senior Software Engineer
     Start Date: 2 weeks from today
     Salary: $150,000/year
     Benefits: Health, 401k, PTO
     Offer Valid Until: 7 days
     ```

4. **Send**: Click "Send Offer"

#### Expected Results:
- ✅ Offer created successfully
- ✅ Offer email logged
- ✅ Status: "Offer Extended"
- ✅ Offer appears in candidate's dashboard

#### API Endpoints Tested:
- `POST /api/v1/applications/:id/offer`
- `GET /api/v1/applications/:id`

---

### Scenario 15: GDPR Compliance Testing

#### Test Steps:
1. **Login as Candidate**: jane.doe@example.com
2. **Navigate to Privacy Settings**: Profile → Privacy

#### Test 15.1: Data Export
1. Click "Download My Data"
2. Request export

**Expected**:
- ✅ Success message
- ✅ Export queued
- ✅ Email with download link logged
- ✅ JSON file contains all user data

#### Test 15.2: View Consent History
1. Click "Consent History"

**Expected**:
- ✅ All consents listed with timestamps
- ✅ Shows consent type, status, version
- ✅ Option to withdraw consent

#### Test 15.3: Withdraw Consent
1. Click "Withdraw" on "Marketing Communications"
2. Confirm withdrawal

**Expected**:
- ✅ Consent withdrawn successfully
- ✅ Status updated to "Withdrawn"
- ✅ New consent log created

#### Test 15.4: Delete Account
1. Click "Delete Account"
2. Read warning
3. Enter password
4. Confirm deletion

**Expected**:
- ✅ Confirmation email logged
- ✅ Account marked for deletion
- ✅ Personal data anonymized after 30 days

#### API Endpoints Tested:
- `GET /api/v1/gdpr/export`
- `GET /api/v1/gdpr/consent-history`
- `POST /api/v1/gdpr/withdraw-consent`
- `DELETE /api/v1/gdpr/delete-account`

---

## Performance Testing

### Load Test Scenarios

#### Test 1: Concurrent Logins
```bash
# Using Apache Bench or artillery.io
ab -n 100 -c 10 http://localhost:5001/api/v1/auth/login
```

**Expected**: < 500ms average response time

#### Test 2: Job Listing with Pagination
```bash
# 1000 jobs, 50 per page
GET /api/v1/jobs?page=1&limit=50
```

**Expected**: < 200ms response time

#### Test 3: File Upload (Resume)
```bash
# 5MB PDF upload
POST /api/v1/upload/resume
```

**Expected**: < 3s upload time

---

## Security Testing

### Test 1: Authentication
- ❌ Access protected routes without token → 401 Unauthorized
- ❌ Use expired token → 401 Unauthorized  
- ❌ Use invalid token → 401 Unauthorized
- ✅ Use valid token → 200 OK

### Test 2: Authorization
- ❌ Candidate access admin routes → 403 Forbidden
- ❌ HR access other company's data → 403 Forbidden
- ✅ Admin access all routes → 200 OK

### Test 3: Input Validation
- ❌ Submit XSS payload in job description → Sanitized
- ❌ Submit SQL injection in search → Sanitized
- ❌ Upload executable as resume → Rejected
- ✅ Valid input → Accepted

### Test 4: Rate Limiting
- ❌ 101 requests in 15 min → 429 Too Many Requests
- ✅ 100 requests in 15 min → 200 OK

---

## Data Integrity Testing

### Test 1: Audit Logs
```bash
# Every action should create audit log
db.auditlogs.find({ userId: ObjectId("...") }).count()
```

**Expected**: Logs for login, profile update, application submit, etc.

### Test 2: Consent Logs
```bash
db.consentlogs.find({ userEmail: "jane.doe@example.com" })
```

**Expected**: Consent records for all agreements

### Test 3: Data Retention
```bash
# Run cleanup script
node scripts/dataRetentionCleanup.js
```

**Expected**:
- Proctoring events > 90 days deleted
- Audit logs > 2 years deleted
- Old applications anonymized

---

## Browser Compatibility Testing

### Supported Browsers:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### Test Each Scenario On:
1. Chrome (primary)
2. Firefox
3. Safari (macOS)
4. Edge

---

## Mobile Responsiveness Testing

### Test on Viewports:
- 📱 Mobile (375px): Login, Browse Jobs, View Profile
- 📱 Tablet (768px): Dashboard, Applications, Interviews
- 💻 Desktop (1920px): Full functionality

---

## Error Handling Testing

### Test Error Scenarios:

#### 1. Network Errors
- Disconnect internet during API call
- **Expected**: Retry mechanism, user-friendly error

#### 2. Database Errors
- Stop MongoDB during operation
- **Expected**: Graceful error, log error, retry

#### 3. Validation Errors
- Submit invalid email format
- **Expected**: Field-level error message

#### 4. Server Errors
- Trigger 500 error
- **Expected**: Generic error message, error logged

---

## Test Data Cleanup

### After Testing:
```bash
# MongoDB cleanup
use recruitpro
db.users.deleteMany({ email: /test|example\.com/ })
db.applications.deleteMany({})
db.interviews.deleteMany({})
db.jobs.deleteMany({})
db.auditlogs.deleteMany({})
db.consentlogs.deleteMany({})
db.proctoringevents.deleteMany({})

# Or drop entire test database
db.dropDatabase()
```

---

## Test Checklist Summary

### Critical Flows (Must Pass):
- [ ] Admin login and dashboard
- [ ] HR user invitation and registration
- [ ] HR login and job posting
- [ ] Candidate registration and profile setup
- [ ] Job application submission
- [ ] Interview scheduling
- [ ] Interview with proctoring
- [ ] GDPR data export
- [ ] GDPR account deletion

### Secondary Flows:
- [ ] Password reset
- [ ] Email verification (if enabled)
- [ ] 2FA setup (if enabled)
- [ ] Bulk operations
- [ ] Analytics and reports
- [ ] Calendar integration

### Non-Functional:
- [ ] Performance (< 500ms avg response)
- [ ] Security (authentication, authorization)
- [ ] Error handling
- [ ] Browser compatibility
- [ ] Mobile responsiveness
- [ ] Audit logging
- [ ] Data retention compliance

---

## Sign-Off Criteria

### Before Production:
1. ✅ All critical flows pass
2. ✅ All security tests pass
3. ✅ Performance benchmarks met
4. ✅ GDPR compliance verified
5. ✅ Audit logs working correctly
6. ✅ Error handling implemented
7. ✅ Email service configured (real SMTP)
8. ✅ File storage configured (AWS S3)
9. ✅ SSL certificates installed
10. ✅ Environment variables secured

### Documentation Required:
- ✅ API documentation (Swagger)
- ✅ User documentation (completed)
- ✅ Admin guide
- ✅ Deployment guide
- ✅ Troubleshooting guide

---

## Test Execution Log

Date: ___________
Tester: ___________

| Scenario | Status | Notes | Issues |
|----------|--------|-------|--------|
| 1. Admin Login | ⬜ Pass ⬜ Fail | | |
| 2. Create HR User | ⬜ Pass ⬜ Fail | | |
| 3. HR Registration | ⬜ Pass ⬜ Fail | | |
| 4. HR Login | ⬜ Pass ⬜ Fail | | |
| 5. Create Job | ⬜ Pass ⬜ Fail | | |
| 6. Candidate Registration | ⬜ Pass ⬜ Fail | | |
| 7. Profile Setup | ⬜ Pass ⬜ Fail | | |
| 8. Apply for Job | ⬜ Pass ⬜ Fail | | |
| 9. Review Application | ⬜ Pass ⬜ Fail | | |
| 10. Schedule Interview | ⬜ Pass ⬜ Fail | | |
| 11. Interview Prep | ⬜ Pass ⬜ Fail | | |
| 12. Join Interview | ⬜ Pass ⬜ Fail | | |
| 13. Conduct Interview | ⬜ Pass ⬜ Fail | | |
| 14. Hiring Decision | ⬜ Pass ⬜ Fail | | |
| 15. GDPR Compliance | ⬜ Pass ⬜ Fail | | |

---

## Known Issues & Limitations

### Current Limitations (Development Mode):
1. Email sending disabled (SKIP_EMAIL=true)
   - Invitation URLs logged to console
   - Manual copy/paste required

2. File upload placeholder
   - Resume upload may need S3 configuration
   - Fallback to local storage

3. Video conferencing
   - Meeting links are placeholders
   - Real integration needs Zoom/Teams API

### To Be Implemented:
1. Real-time WebSocket notifications
2. Calendar sync (Google/Outlook)
3. SMS notifications
4. Advanced analytics
5. AI-powered resume parsing
6. Candidate sourcing from job portals

---

## Next Steps

1. **Run End-to-End Tests**: Follow scenarios 1-15
2. **Document Issues**: Log any bugs found
3. **Fix Critical Issues**: Address blocking issues
4. **Re-test**: Verify fixes
5. **Sign-Off**: Complete checklist
6. **Prepare for Production**: Configure real services
