const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function updatePassword() {
  try {
    const email = process.argv[2] || 'candidate@test.com';
    const newPassword = process.argv[3] || 'Test@123';
    
    await mongoose.connect('mongodb://localhost:27017/recruitpro');
    console.log('Connected to MongoDB\n');

    const user = await mongoose.connection.db.collection('users').findOne({ email });
    
    if (!user) {
      console.log('❌ No user found with email:', email);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('User found:', user.firstName, user.lastName);
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    console.log('\nUpdating password...');

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
    const result = await mongoose.connection.db.collection('users').updateOne(
      { email },
      { $set: { password: hashedPassword } }
    );

    if (result.modifiedCount > 0) {
      console.log('\n✅ Password updated successfully!\n');
      console.log('Login Credentials:');
      console.log('==================');
      console.log('Email:', email);
      console.log('Password:', newPassword);
      console.log('\nYou can now login at: http://localhost:3000/login');
    } else {
      console.log('❌ Failed to update password');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

updatePassword();
