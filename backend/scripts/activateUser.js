const mongoose = require('mongoose');

async function activateUser() {
  try {
    const email = process.argv[2];
    
    if (!email) {
      console.error('❌ Please provide an email address');
      console.log('Usage: node activateUser.js <email>');
      process.exit(1);
    }

    await mongoose.connect('mongodb://localhost:27017/recruitpro');
    console.log('Connected to MongoDB');

    const result = await mongoose.connection.db.collection('users').updateOne(
      { email: email },
      { $set: { status: 'active', emailVerified: true } }
    );

    console.log('Update result:', result);
    
    if (result.matchedCount === 0) {
      console.log('❌ No user found with email:', email);
    } else if (result.modifiedCount === 0) {
      console.log('⚠️  User already activated:', email);
    } else {
      console.log('✅ User activated successfully:', email);
    }
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

activateUser();
