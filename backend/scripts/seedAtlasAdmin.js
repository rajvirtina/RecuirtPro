const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seed() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('MONGODB_URI not set in .env');
      process.exit(1);
    }
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(uri);
    console.log('Connected!');

    const email = 'superadmin@recruitpro.com';
    const password = 'SuperAdmin@2025#Secure';
    const hashedPassword = await bcrypt.hash(password, 12);

    const existing = await mongoose.connection.db.collection('users').findOne({ email });
    if (existing) {
      console.log('Super admin already exists, updating...');
      await mongoose.connection.db.collection('users').updateOne(
        { email },
        { $set: { role: 'admin', status: 'active', isSuperAdminUser: true, password: hashedPassword } }
      );
    } else {
      console.log('Creating super admin...');
      await mongoose.connection.db.collection('users').insertOne({
        firstName: 'Super',
        lastName: 'Admin',
        email,
        password: hashedPassword,
        role: 'admin',
        status: 'active',
        isSuperAdminUser: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    console.log('Super admin seeded successfully!');
    console.log('Email:', email);
    console.log('Password: SuperAdmin@2025#Secure');
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}
seed();
