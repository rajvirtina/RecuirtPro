const mongoose = require('mongoose');

async function activateAllPending() {
  try {
    await mongoose.connect('mongodb://localhost:27017/recruitpro');
    console.log('Connected to MongoDB\n');

    const result = await mongoose.connection.db.collection('users').updateMany(
      { status: 'pending_verification' },
      { $set: { status: 'active', emailVerified: true } }
    );

    console.log('Update result:', result);
    console.log(`✅ Activated ${result.modifiedCount} pending users`);
    
    // List all activated users
    const users = await mongoose.connection.db.collection('users')
      .find({ status: 'active' })
      .project({ email: 1, firstName: 1, lastName: 1, role: 1 })
      .toArray();
    
    console.log('\nActive users:');
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.firstName} ${user.lastName}) - Role: ${user.role}`);
    });
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

activateAllPending();
