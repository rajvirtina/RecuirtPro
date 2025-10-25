const mongoose = require('mongoose');

async function makeAdmin() {
  try {
    const email = process.argv[2] || 'admin@company.com';
    
    await mongoose.connect('mongodb://localhost:27017/recruitpro');
    console.log('Connected to MongoDB\n');

    const result = await mongoose.connection.db.collection('users').updateOne(
      { email },
      { $set: { role: 'admin' } }
    );
    
    if (result.matchedCount === 0) {
      console.log('❌ No user found with email:', email);
    } else {
      console.log('✅ Successfully updated user to admin role');
      
      // Fetch and display updated user
      const user = await mongoose.connection.db.collection('users').findOne({ email });
      console.log('\nUpdated user:');
      console.log('Email:', user.email);
      console.log('Role:', user.role);
      console.log('Status:', user.status);
      console.log('Name:', user.firstName, user.lastName);
    }
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

makeAdmin();
