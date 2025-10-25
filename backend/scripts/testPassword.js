const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function testPassword() {
  try {
    const email = 'admin@company.com';
    const password = 'Balaraj@13';
    
    await mongoose.connect('mongodb://localhost:27017/recruitpro');
    console.log('Connected to MongoDB\n');

    const user = await mongoose.connection.db.collection('users').findOne({ email });
    
    if (!user) {
      console.log('❌ No user found');
      await mongoose.disconnect();
      return;
    }
    
    console.log('User Status:', user.status);
    console.log('Email Verified:', user.emailVerified);
    console.log('Stored Password Hash:', user.password);
    
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('\nPassword Match:', isMatch);
    
    if (!isMatch) {
      console.log('❌ Password does not match!');
    } else {
      console.log('✅ Password matches!');
    }
    
    if (user.status !== 'active') {
      console.log('❌ Status issue: Status is', user.status, 'but should be "active"');
    } else {
      console.log('✅ Status is active');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testPassword();
