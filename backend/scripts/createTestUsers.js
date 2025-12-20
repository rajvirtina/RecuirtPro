const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Script to create test users for the application
 */

async function createTestUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/recruitpro');
    console.log('✅ Connected to MongoDB\n');

    const password = 'Admin@123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Define users
    const users = [
      {
        email: 'admin@company.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        status: 'active',
        emailVerified: true,
        companyId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        email: 'newhr@test.com',
        password: hashedPassword,
        firstName: 'HR',
        lastName: 'Manager',
        role: 'hr',
        status: 'active',
        emailVerified: true,
        companyId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        email: 'testcandidate@test.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'Candidate',
        role: 'candidate',
        status: 'active',
        emailVerified: true,
        companyId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Creating Test Users');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const user of users) {
      // Check if user already exists
      const existingUser = await mongoose.connection.db.collection('users').findOne({ email: user.email });
      
      if (existingUser) {
        // Update existing user
        await mongoose.connection.db.collection('users').updateOne(
          { email: user.email },
          { $set: user }
        );
        console.log(`✅ Updated: ${user.email} (${user.role})`);
      } else {
        // Create new user
        await mongoose.connection.db.collection('users').insertOne(user);
        console.log(`✅ Created: ${user.email} (${user.role})`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ All test users created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin:     admin@company.com');
    console.log('HR:        newhr@test.com');
    console.log('Candidate: testcandidate@test.com');
    console.log('Password:  Admin@123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTestUsers();
