/**
 * Quick HR Registration Test
 * Tests using the HR user created by the full test
 */

const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:5001/api/v1';
const FRONTEND_URL = 'http://localhost:3000';

// Token from backend console
const INVITATION_TOKEN = '42a70aee3b4be4eea039f623589d45d957b90b97928c033077d07cfdd8ff0e51';
const HR_EMAIL = 'testhr@example.com';
const HR_PASSWORD = 'Test@12345';

async function testRegistration() {
  console.log('🧪 Quick HR Registration Test\n');
  console.log('═'.repeat(60));

  // TEST 1: Verify Token
  console.log('\n📝 TEST 1: Verify Invitation Token');
  console.log('─'.repeat(60));
  try {
    const response = await axios.post(`${BASE_URL}/hr/verify-invitation`, {
      token: INVITATION_TOKEN
    });
    
    console.log('✅ Token verification successful!');
    console.log(`   User: ${response.data.data.user.firstName} ${response.data.data.user.lastName}`);
    console.log(`   Email: ${response.data.data.user.email}`);
    console.log(`   Role: ${response.data.data.user.role}`);
    
    // Verify hash
    const hashedToken = crypto.createHash('sha256').update(INVITATION_TOKEN).digest('hex');
    console.log(`\n   🔐 Token Hashing:`);
    console.log(`   Plain:  ${INVITATION_TOKEN.substring(0, 32)}...`);
    console.log(`   Hashed: ${hashedToken.substring(0, 32)}...`);
  } catch (error) {
    console.log('❌ Token verification failed!');
    console.log(`   Error: ${error.response?.data?.message || error.message}`);
    return;
  }

  // TEST 2: Complete Registration
  console.log('\n📝 TEST 2: Complete Registration');
  console.log('─'.repeat(60));
  try {
    const response = await axios.post(`${BASE_URL}/hr/complete-registration`, {
      token: INVITATION_TOKEN,
      password: HR_PASSWORD,
      phone: '+1234567890',
      enable2FA: false,
    });

    console.log('✅ Registration completed successfully!');
    console.log(`   User Status: ${response.data.data.user.status}`);
    console.log(`   Email Verified: ${response.data.data.user.emailVerified}`);
    console.log(`   MFA Enabled: ${response.data.data.user.mfaEnabled}`);
    console.log(`   Access Token: ${response.data.data.accessToken.substring(0, 30)}...`);
    
    // Save token for next test
    const accessToken = response.data.data.accessToken;

    // TEST 3: Login with new credentials
    console.log('\n📝 TEST 3: Login with New Credentials');
    console.log('─'.repeat(60));
    try {
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
        email: HR_EMAIL,
        password: HR_PASSWORD,
      });

      console.log('✅ Login successful!');
      console.log(`   Token: ${loginResponse.data.data.accessToken.substring(0, 30)}...`);
      
      // TEST 4: Access protected route
      console.log('\n📝 TEST 4: Access HR Dashboard');
      console.log('─'.repeat(60));
      try {
        const dashboardResponse = await axios.get(`${BASE_URL}/dashboard/hr-stats`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        console.log('✅ Dashboard access successful!');
        console.log(`   Data retrieved successfully`);
      } catch (error) {
        console.log('❌ Dashboard access failed');
        console.log(`   Error: ${error.response?.data?.message || error.message}`);
      }

    } catch (error) {
      console.log('❌ Login failed');
      console.log(`   Error: ${error.response?.data?.message || error.message}`);
    }

  } catch (error) {
    console.log('❌ Registration failed!');
    console.log(`   Error: ${error.response?.data?.message || error.message}`);
    if (error.response?.data) {
      console.log('   Details:', JSON.stringify(error.response.data, null, 2));
    }
  }

  // Frontend URL
  console.log('\n' + '═'.repeat(60));
  console.log('🌐 FRONTEND REGISTRATION URL:');
  console.log('═'.repeat(60));
  console.log(`${FRONTEND_URL}/complete-registration?token=${INVITATION_TOKEN}`);
  console.log('\n✨ Copy this URL and paste in your browser to test the UI\n');
}

testRegistration();
