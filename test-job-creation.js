/**
 * Test job creation for HR user
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api/v1';

async function testJobCreation() {
  try {
    console.log('🧪 Testing Job Creation for HR User\n');
    console.log('═'.repeat(60));

    // Login as HR user
    console.log('\n📝 Step 1: Login as HR user');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'testhr@example.com',
      password: 'Test@12345',
    });

    const token = loginResponse.data.data.accessToken;
    console.log('✅ Login successful');
    console.log(`   Token: ${token.substring(0, 30)}...`);

    // Create a job
    console.log('\n📝 Step 2: Create a new job');
    const jobData = {
      title: 'SDET ROLE',
      description: 'SDET position with automation testing experience',
      location: 'Hyderabad',
      jobType: 'full_time',
      workMode: 'onsite',
      experienceMin: 10,
      experienceMax: 24,
      salaryMin: 100000,
      salaryMax: 500000,
      currency: 'INR',
      skills: ['Java', 'SDET', 'Testing'],
      requirements: ['Selenium'],
    };

    const jobResponse = await axios.post(`${BASE_URL}/jobs`, jobData, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log('✅ Job created successfully!');
    console.log(`   Job ID: ${jobResponse.data.data.job._id}`);
    console.log(`   Title: ${jobResponse.data.data.job.title}`);
    console.log(`   Company ID: ${jobResponse.data.data.job.companyId}`);
    console.log(`   Status: ${jobResponse.data.data.job.status}`);

    console.log('\n' + '═'.repeat(60));
    console.log('✅ All tests passed!');
    console.log('\nNow you can create jobs from the UI! 🎉');
    
  } catch (error) {
    console.log('\n' + '═'.repeat(60));
    console.log('❌ Test failed!');
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Message: ${error.response.data.message}`);
      if (error.response.data.errors) {
        console.log(`   Errors: ${error.response.data.errors.join(', ')}`);
      }
    } else {
      console.log(`   Error: ${error.message}`);
    }
  }
}

testJobCreation();
