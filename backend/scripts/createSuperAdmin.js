const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Script to create a Super Admin account
 * Usage: node createSuperAdmin.js <email> <password> [firstName] [lastName]
 * Example: node createSuperAdmin.js superadmin@recruitpro.com Admin@123 Super Admin
 */

async function createSuperAdmin() {
  try {
    // Get arguments
    const email = process.argv[2];
    const password = process.argv[3];
    const firstName = process.argv[4] || 'Super';
    const lastName = process.argv[5] || 'Admin';

    // Validate inputs
    if (!email || !password) {
      console.log('❌ Error: Email and password are required!\n');
      console.log('Usage: node createSuperAdmin.js <email> <password> [firstName] [lastName]');
      console.log('Example: node createSuperAdmin.js superadmin@recruitpro.com Admin@123 Super Admin\n');
      process.exit(1);
    }

    // Validate password strength
    if (password.length < 6) {
      console.log('❌ Error: Password must be at least 6 characters long\n');
      process.exit(1);
    }

    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/recruitpro');
    console.log('✅ Connected to MongoDB\n');

    // Check if user already exists
    const existingUser = await mongoose.connection.db.collection('users').findOne({ email });
    
    if (existingUser) {
      console.log('⚠️  User already exists with this email!');
      console.log('Email:', existingUser.email);
      console.log('Role:', existingUser.role);
      console.log('Status:', existingUser.status);
      console.log('\nDo you want to update this user to Super Admin? (yes/no)');
      
      // For automation, you can pass 'yes' as 6th argument
      const shouldUpdate = process.argv[6] === 'yes';
      
      if (!shouldUpdate) {
        console.log('\n💡 To update existing user, run:');
        console.log(`   node makeAdmin.js ${email}`);
        await mongoose.disconnect();
        process.exit(0);
      }
      
      // Update existing user
      const hashedPassword = await bcrypt.hash(password, 10);
      await mongoose.connection.db.collection('users').updateOne(
        { email },
        { 
          $set: { 
            role: 'admin',
            status: 'active',
            password: hashedPassword,
            firstName,
            lastName,
            emailVerified: true,
            updatedAt: new Date()
          } 
        }
      );
      console.log('\n✅ Successfully updated user to Super Admin!');
    } else {
      // Create new super admin
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const superAdmin = {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'admin',
        status: 'active',
        emailVerified: true,
        companyId: null, // Super admin doesn't belong to any company
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await mongoose.connection.db.collection('users').insertOne(superAdmin);
      console.log('✅ Successfully created Super Admin account!\n');
    }

    // Fetch and display the user
    const user = await mongoose.connection.db.collection('users').findOne({ email });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Super Admin Account Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Email:    ', user.email);
    console.log('Name:     ', user.firstName, user.lastName);
    console.log('Role:     ', user.role.toUpperCase());
    console.log('Status:   ', user.status.toUpperCase());
    console.log('Verified: ', user.emailVerified ? 'Yes' : 'No');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('🎉 You can now login with these credentials:');
    console.log('   Email:   ', email);
    console.log('   Password:', password);
    console.log('\n💡 Login URL: http://localhost:5173/login\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createSuperAdmin();
