const mongoose = require('mongoose');

async function checkUser() {
  try {
    const email = process.argv[2] || 'admin@company.com';
    
    await mongoose.connect('mongodb://localhost:27017/recruitpro');
    console.log('Connected to MongoDB\n');

    const user = await mongoose.connection.db.collection('users').findOne({ email });
    
    if (!user) {
      console.log('❌ No user found with email:', email);
    } else {
      console.log('User found:');
      console.log('Email:', user.email);
      console.log('Status:', user.status);
      console.log('Email Verified:', user.emailVerified);
      console.log('Role:', user.role);
      console.log('First Name:', user.firstName);
      console.log('Last Name:', user.lastName);
      console.log('\nFull user object:');
      console.log(JSON.stringify(user, null, 2));
    }
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUser();
