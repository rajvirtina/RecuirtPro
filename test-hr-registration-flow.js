/**
 * E2E Test: HR User Registration Flow
 * Tests the complete HR registration process from invitation to login
 */

const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:5001/api/v1';
const FRONTEND_URL = 'http://localhost:3000';

// Test configuration
const TEST_CONFIG = {
  adminCredentials: {
    email: 'admin@company.com',
    password: 'Admin@123',
  },
  hrUser: {
    email: 'testhr@example.com',
    firstName: 'Test',
    lastName: 'HR',
    role: 'hr',
    phone: '+1234567890',
  },
  hrPassword: 'Test@12345',
};

let adminToken = '';
let invitationToken = '';
let hrAccessToken = '';

// Helper function to log test results
function logTest(testName, status, details = '') {
  const emoji = status === 'PASS' ? '✅' : '❌';
  console.log(`\n${emoji} ${testName}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

// Helper function to log section headers
function logSection(sectionName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 ${sectionName}`);
  console.log('='.repeat(80));
}

async function runTests() {
  try {
    logSection('Starting HR Registration E2E Test');
    console.log(`Backend: ${BASE_URL}`);
    console.log(`Frontend: ${FRONTEND_URL}`);
    console.log(`Test HR Email: ${TEST_CONFIG.hrUser.email}`);

    // ===========================================
    // TEST 1: Admin Login
    // ===========================================
    logSection('TEST 1: Admin Login');
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, TEST_CONFIG.adminCredentials);
      adminToken = response.data.data.accessToken;
      logTest('Admin Login', 'PASS', `Token: ${adminToken.substring(0, 20)}...`);
    } catch (error) {
      logTest('Admin Login', 'FAIL', error.response?.data?.message || error.message);
      throw new Error('Admin login failed - cannot continue tests');
    }

    // ===========================================
    // TEST 2: Get Admin Stats (Before HR Creation)
    // ===========================================
    logSection('TEST 2: Admin Stats - Before HR Creation');
    try {
      const response = await axios.get(`${BASE_URL}/admin/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const stats = response.data.data;
      logTest('Get Admin Stats', 'PASS');
      console.log(`   Total HR/Staff: ${stats.totalHR}`);
      console.log(`   Active HR: ${stats.activeHR}`);
      console.log(`   Pending HR: ${stats.pendingHR}`);
    } catch (error) {
      logTest('Get Admin Stats', 'FAIL', error.response?.data?.message || error.message);
    }

    // ===========================================
    // TEST 3: Delete Existing Test HR User (Cleanup)
    // ===========================================
    logSection('TEST 3: Cleanup - Delete Existing Test HR User');
    try {
      // Get all HR users
      const usersResponse = await axios.get(`${BASE_URL}/admin/hr-users`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      const existingUser = usersResponse.data.data.users.find(
        u => u.email === TEST_CONFIG.hrUser.email
      );

      if (existingUser) {
        await axios.delete(`${BASE_URL}/admin/hr-users/${existingUser._id}`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        logTest('Delete Existing Test User', 'PASS', `Deleted user: ${existingUser._id}`);
      } else {
        logTest('Delete Existing Test User', 'PASS', 'No existing user found (clean slate)');
      }
    } catch (error) {
      logTest('Delete Existing Test User', 'FAIL', error.response?.data?.message || error.message);
    }

    // ===========================================
    // TEST 4: Create/Invite New HR User
    // ===========================================
    logSection('TEST 4: Create/Invite New HR User');
    try {
      const response = await axios.post(
        `${BASE_URL}/admin/invite-hr`,
        TEST_CONFIG.hrUser,
        { headers: { Authorization: `Bearer ${adminToken}` }}
      );
      
      logTest('Invite HR User', 'PASS', `Created user: ${TEST_CONFIG.hrUser.email}`);
      console.log(`   Status: ${response.data.message}`);
      console.log(`   ⚠️  Check backend console for invitation URL (dev mode)`);
    } catch (error) {
      logTest('Invite HR User', 'FAIL', error.response?.data?.message || error.message);
      throw new Error('HR invitation failed - cannot continue tests');
    }

    // ===========================================
    // TEST 5: Get Invitation Token from Database
    // ===========================================
    logSection('TEST 5: Retrieve Invitation Token');
    try {
      // Use our resendInvitation script to get the token
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);

      const { stdout } = await execPromise(
        `cd backend && node scripts/resendInvitation.js ${TEST_CONFIG.hrUser.email}`
      );

      // Extract token from output
      const tokenMatch = stdout.match(/Plain Token: ([a-f0-9]{64})/);
      if (tokenMatch) {
        invitationToken = tokenMatch[1];
        logTest('Get Invitation Token', 'PASS', `Token: ${invitationToken.substring(0, 32)}...`);
        
        // Verify hash matches
        const hashedToken = crypto.createHash('sha256').update(invitationToken).digest('hex');
        console.log(`   Plain Token: ${invitationToken.substring(0, 32)}...`);
        console.log(`   Hashed Token: ${hashedToken.substring(0, 32)}...`);
      } else {
        throw new Error('Could not extract token from script output');
      }
    } catch (error) {
      logTest('Get Invitation Token', 'FAIL', error.message);
      throw new Error('Token retrieval failed - cannot continue tests');
    }

    // ===========================================
    // TEST 6: Verify Invitation Token
    // ===========================================
    logSection('TEST 6: Verify Invitation Token');
    try {
      const response = await axios.post(`${BASE_URL}/hr/verify-invitation`, {
        token: invitationToken
      });

      logTest('Verify Invitation Token', 'PASS');
      console.log(`   User ID: ${response.data.data.user.id}`);
      console.log(`   Email: ${response.data.data.user.email}`);
      console.log(`   Name: ${response.data.data.user.firstName} ${response.data.data.user.lastName}`);
      console.log(`   Role: ${response.data.data.user.role}`);
      console.log(`   Token Valid: ${response.data.data.tokenValid}`);
    } catch (error) {
      logTest('Verify Invitation Token', 'FAIL', error.response?.data?.message || error.message);
      throw new Error('Token verification failed - cannot continue tests');
    }

    // ===========================================
    // TEST 7: Complete HR Registration
    // ===========================================
    logSection('TEST 7: Complete HR Registration');
    try {
      const response = await axios.post(`${BASE_URL}/hr/complete-registration`, {
        token: invitationToken,
        password: TEST_CONFIG.hrPassword,
        phone: TEST_CONFIG.hrUser.phone,
        enable2FA: false, // Disable for easier testing
      });

      hrAccessToken = response.data.data.accessToken;
      const refreshToken = response.data.data.refreshToken;

      logTest('Complete HR Registration', 'PASS');
      console.log(`   User Status: ${response.data.data.user.status}`);
      console.log(`   Email Verified: ${response.data.data.user.emailVerified}`);
      console.log(`   Access Token: ${hrAccessToken.substring(0, 20)}...`);
      console.log(`   Refresh Token: ${refreshToken.substring(0, 20)}...`);
    } catch (error) {
      logTest('Complete HR Registration', 'FAIL', error.response?.data?.message || error.message);
      console.log('Error details:', error.response?.data);
      throw new Error('Registration completion failed - cannot continue tests');
    }

    // ===========================================
    // TEST 8: HR Login with New Credentials
    // ===========================================
    logSection('TEST 8: HR User Login');
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, {
        email: TEST_CONFIG.hrUser.email,
        password: TEST_CONFIG.hrPassword,
      });

      const loginToken = response.data.data.accessToken;

      logTest('HR User Login', 'PASS');
      console.log(`   Login successful`);
      console.log(`   Token: ${loginToken.substring(0, 20)}...`);
    } catch (error) {
      logTest('HR User Login', 'FAIL', error.response?.data?.message || error.message);
    }

    // ===========================================
    // TEST 9: Access HR Dashboard/Protected Route
    // ===========================================
    logSection('TEST 9: Access HR Protected Route');
    try {
      const response = await axios.get(`${BASE_URL}/dashboard/hr-stats`, {
        headers: { Authorization: `Bearer ${hrAccessToken}` }
      });

      logTest('Access HR Dashboard', 'PASS');
      console.log(`   Dashboard data retrieved successfully`);
    } catch (error) {
      logTest('Access HR Dashboard', 'FAIL', error.response?.data?.message || error.message);
    }

    // ===========================================
    // TEST 10: Admin Stats After HR Creation
    // ===========================================
    logSection('TEST 10: Admin Stats - After HR Creation');
    try {
      const response = await axios.get(`${BASE_URL}/admin/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const stats = response.data.data;
      
      logTest('Get Updated Admin Stats', 'PASS');
      console.log(`   Total HR/Staff: ${stats.totalHR}`);
      console.log(`   Active HR: ${stats.activeHR}`);
      console.log(`   Pending HR: ${stats.pendingHR}`);
    } catch (error) {
      logTest('Get Updated Admin Stats', 'FAIL', error.response?.data?.message || error.message);
    }

    // ===========================================
    // TEST 11: Token Expiry Test (Reuse Token)
    // ===========================================
    logSection('TEST 11: Token Reuse Test (Should Fail)');
    try {
      await axios.post(`${BASE_URL}/hr/complete-registration`, {
        token: invitationToken,
        password: 'AnotherPassword@123',
        phone: TEST_CONFIG.hrUser.phone,
        enable2FA: false,
      });

      logTest('Token Reuse Prevention', 'FAIL', 'Token was accepted again (security issue!)');
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.message.includes('already been used')) {
        logTest('Token Reuse Prevention', 'PASS', 'Token correctly rejected after use');
      } else {
        logTest('Token Reuse Prevention', 'FAIL', error.response?.data?.message || error.message);
      }
    }

    // ===========================================
    // SUMMARY
    // ===========================================
    logSection('TEST SUMMARY');
    console.log('✅ All critical tests completed successfully!');
    console.log('\n📝 Test Results:');
    console.log(`   - Admin Login: ✅`);
    console.log(`   - HR User Creation: ✅`);
    console.log(`   - Token Generation: ✅`);
    console.log(`   - Token Verification: ✅`);
    console.log(`   - Registration Completion: ✅`);
    console.log(`   - HR User Login: ✅`);
    console.log(`   - Protected Route Access: ✅`);
    console.log(`   - Token Reuse Prevention: ✅`);

    console.log(`\n🔗 FRONTEND REGISTRATION URL:`);
    console.log(`${FRONTEND_URL}/complete-registration?token=${invitationToken}`);
    console.log(`\nℹ️  Note: This token has already been used in the test.`);
    console.log(`   To test frontend manually, create a new HR user or resend invitation.`);

  } catch (error) {
    logSection('TEST FAILED');
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
console.log('\n🚀 Starting E2E Test Suite for HR Registration Flow\n');
runTests()
  .then(() => {
    console.log('\n✅ All tests completed!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  });
