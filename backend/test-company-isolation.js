const mongoose = require('mongoose');
const axios = require('axios');

async function testCompanyIsolation() {
  try {
    // Connect to MongoDB to verify data
    await mongoose.connect('mongodb://localhost:27017/recruitpro');
    
    console.log('=== DATABASE CHECK ===');
    const yashUser = await mongoose.connection.db.collection('users').findOne({ email: 'yash@2company.com' });
    console.log('Yash User CompanyID in DB:', yashUser.companyId);
    
    const jobs = await mongoose.connection.db.collection('jobs').find({ deletedAt: null }).toArray();
    console.log('\nJobs in DB:');
    jobs.forEach(j => console.log(`  - ${j.title} | CompanyID: ${j.companyId}`));
    
    // Test API
    console.log('\n=== API TEST ===');
    const loginRes = await axios.post('http://localhost:5001/api/v1/auth/login', {
      email: 'yash@2company.com',
      password: 'Yash@123'
    });
    
    console.log('Login successful!');
    console.log('User Email:', loginRes.data.data.user.email);
    console.log('User Role:', loginRes.data.data.user.role);
    console.log('User CompanyID in response:', loginRes.data.data.user.companyId || 'NULL/UNDEFINED');
    console.log('Full user object:', JSON.stringify(loginRes.data.data.user, null, 2));
    
    const token = loginRes.data.data.accessToken;
    
    console.log('\n=== FETCHING JOBS ===');
    const jobsRes = await axios.get('http://localhost:5001/api/v1/jobs?page=1&limit=10', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('Jobs returned:', jobsRes.data.data.length);
    jobsRes.data.data.forEach(j => {
      console.log(`  - ${j.title} | Company: ${j.companyId.name} | CompanyID: ${j.companyId._id}`);
    });
    
    if (jobsRes.data.data.length === 0) {
      console.log('\n✅ SUCCESS! Yash Tech HR sees NO jobs (correct - they have no jobs posted)');
    } else {
      console.log('\n❌ FAILED! Yash Tech HR can see jobs from other companies');
    }
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error Message:', error.message);
    console.error('Error Code:', error.code);
    console.error('Response Status:', error.response?.status);
    console.error('Response Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('Request:', error.request?._header?.split('\r\n')[0]);
    if (mongoose.connection.readyState === 1) await mongoose.connection.close();
    process.exit(1);
  }
}

testCompanyIsolation();
