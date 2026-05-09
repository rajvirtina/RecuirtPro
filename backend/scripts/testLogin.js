require('dotenv').config();
const mongoose = require('mongoose');

async function testLogin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/recruitpro');
    console.log('✅ Connected to MongoDB\n');

    // Import User model after connection
    const { User } = require('../dist/models/User');

    const testUsers = [
      'admin@company.com',
      'superadmin@company.com',
      'newhr@test.com',
      'testcandidate@test.com'
    ];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Testing Login for All Users');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const email of testUsers) {
      try {
        const user = await User.findByCredentials(email, 'Admin@123');
        console.log(`✅ ${email} - Login SUCCESS`);
        console.log(`   Role: ${user.role}, Status: ${user.status}\n`);
      } catch (error) {
        console.log(`❌ ${email} - Login FAILED`);
        console.log(`   Error: ${error.message}\n`);
      }
    }

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testLogin();
