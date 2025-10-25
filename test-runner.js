#!/usr/bin/env node

/**
 * Quick Test Runner for RecruiterPro E2E Testing
 * Run this script to execute manual E2E tests
 */

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

console.log(`
${colors.cyan}╔═══════════════════════════════════════════════════════╗
║     RecruiterPro - E2E Test Quick Start Guide       ║
╚═══════════════════════════════════════════════════════╝${colors.reset}

${colors.yellow}📋 Test Environment Status:${colors.reset}
`);

// Check if servers are running
const checkServers = () => {
  console.log(`${colors.blue}Checking services...${colors.reset}\n`);
  
  const http = require('http');
  
  // Check backend
  const backendReq = http.get('http://localhost:5001/api/v1/auth/health', (res) => {
    if (res.statusCode === 200 || res.statusCode === 404) {
      console.log(`✅ Backend: ${colors.green}Running${colors.reset} (http://localhost:5001)`);
    }
  });
  
  backendReq.on('error', () => {
    console.log(`❌ Backend: ${colors.red}Not Running${colors.reset}`);
    console.log(`   Start with: cd backend && npm run dev\n`);
  });
  
  // Check frontend
  setTimeout(() => {
    const frontendReq = http.get('http://localhost:3000', (res) => {
      if (res.statusCode === 200) {
        console.log(`✅ Frontend: ${colors.green}Running${colors.reset} (http://localhost:3000)`);
      }
    });
    
    frontendReq.on('error', () => {
      console.log(`❌ Frontend: ${colors.red}Not Running${colors.reset}`);
      console.log(`   Start with: cd frontend && npm run dev\n`);
    });
    
    // Display test instructions after checks
    setTimeout(() => displayInstructions(), 500);
  }, 300);
};

const displayInstructions = () => {
  console.log(`
${colors.yellow}📖 Quick Test Scenarios:${colors.reset}

${colors.cyan}1. Admin Login Test${colors.reset}
   URL: http://localhost:3000
   Email: admin@company.com
   Password: [your admin password]
   
${colors.cyan}2. Invite HR User Test${colors.reset}
   a) Login as admin
   b) Go to "HR Users" → "Invite HR User"
   c) Fill form:
      Email: test.hr@company.com
      First Name: Test
      Last Name: HR
      Role: HR Manager
      Department: Engineering
   d) Click "Send Invitation"
   e) Check console logs for invitation URL
   f) Copy URL: ${colors.yellow}[DEV MODE - EMAIL SKIPPED] Data: {...invitationUrl...}${colors.reset}

${colors.cyan}3. Complete HR Registration${colors.reset}
   a) Copy invitation URL from console (step 2e)
   b) Open URL in browser (incognito/private mode recommended)
   c) Set password: Test@12345
   d) Complete registration
   
${colors.cyan}4. Create Job Posting (HR User)${colors.reset}
   a) Login as HR user (test.hr@company.com)
   b) Go to "Jobs" → "Post New Job"
   c) Fill job details
   d) Publish job
   
${colors.cyan}5. Candidate Registration & Application${colors.reset}
   a) Open new incognito window
   b) Click "Sign Up" → Select "Candidate"
   c) Register: candidate@test.com
   d) Complete profile
   e) Browse jobs → Apply

${colors.cyan}6. Interview Flow${colors.reset}
   a) HR: Review application → Shortlist
   b) HR: Schedule interview
   c) Candidate: Accept interview
   d) Candidate: Join interview (with proctoring check)
   e) HR: Conduct interview → Submit feedback

${colors.cyan}7. GDPR Compliance Test${colors.reset}
   a) Login as candidate
   b) Go to Profile → Privacy
   c) Test: Download My Data
   d) Test: View Consent History
   e) Test: Withdraw Consent
   f) Test: Delete Account

${colors.yellow}📝 Detailed Test Plan:${colors.reset}
   See: END_TO_END_TEST_PLAN.md

${colors.yellow}🔧 Troubleshooting:${colors.reset}
   • Email errors: SKIP_EMAIL=true is set in .env (emails logged only)
   • MongoDB: Ensure running on localhost:27017
   • Ports: Backend(5001), Frontend(3000) must be free
   
${colors.yellow}🗄️  Database Check:${colors.reset}
   # View users
   mongo recruitpro
   db.users.find().pretty()
   
   # View audit logs
   db.auditlogs.find().sort({timestamp: -1}).limit(5).pretty()
   
   # View consent logs
   db.consentlogs.find().pretty()

${colors.green}✨ Ready to test! Open http://localhost:3000${colors.reset}

${colors.cyan}Test Execution Checklist:${colors.reset}
[ ] Backend running on :5001
[ ] Frontend running on :3000
[ ] MongoDB running on :27017
[ ] SKIP_EMAIL=true in backend/.env
[ ] Admin login works
[ ] HR invite works (check console for URL)
[ ] Candidate registration works
[ ] Job posting works
[ ] Application submission works
[ ] Interview scheduling works
[ ] GDPR features work

${colors.yellow}📊 Track your progress in:${colors.reset} END_TO_END_TEST_PLAN.md (Test Execution Log section)

`);
};

// Run checks
checkServers();
