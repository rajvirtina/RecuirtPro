/**
 * Quick test script to check admin API endpoints
 * Run with: node test-admin-api.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api/v1';

// You'll need to replace this with a valid admin token
// To get token: Login as admin in the app, then check localStorage or Network tab
const ADMIN_TOKEN = 'YOUR_ADMIN_TOKEN_HERE';

async function testAdminAPIs() {
  console.log('🔍 Testing Admin API Endpoints...\n');

  const config = {
    headers: {
      'Authorization': `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  try {
    // Test 1: Admin Stats
    console.log('1️⃣ Testing GET /admin/stats');
    const statsResponse = await axios.get(`${BASE_URL}/admin/stats`, config);
    console.log('✅ Stats Response:', JSON.stringify(statsResponse.data, null, 2));
    console.log('');

  } catch (error) {
    console.log('❌ Stats Error:', error.response?.data || error.message);
    console.log('');
  }

  try {
    // Test 2: HR Users
    console.log('2️⃣ Testing GET /admin/hr-users');
    const hrResponse = await axios.get(`${BASE_URL}/admin/hr-users`, config);
    console.log('✅ HR Users Response:', JSON.stringify(hrResponse.data, null, 2));
    console.log('');

  } catch (error) {
    console.log('❌ HR Users Error:', error.response?.data || error.message);
    console.log('');
  }

  try {
    // Test 3: Check Auth
    console.log('3️⃣ Testing GET /auth/me (current user)');
    const meResponse = await axios.get(`${BASE_URL}/auth/me`, config);
    console.log('✅ Current User:', JSON.stringify(meResponse.data, null, 2));
    console.log('');

  } catch (error) {
    console.log('❌ Auth Error:', error.response?.data || error.message);
    console.log('');
  }
}

if (ADMIN_TOKEN === 'YOUR_ADMIN_TOKEN_HERE') {
  console.log('⚠️  Please update ADMIN_TOKEN in this file first!\n');
  console.log('To get your admin token:');
  console.log('1. Login as admin in the app');
  console.log('2. Open browser DevTools (F12)');
  console.log('3. Go to Application → Local Storage → http://localhost:3001');
  console.log('4. Copy the value of "token"');
  console.log('5. Paste it in this file replacing YOUR_ADMIN_TOKEN_HERE\n');
} else {
  testAdminAPIs();
}
