/**
 * Script to assign a default company to HR users who don't have one
 */

const mongoose = require('mongoose');
const path = require('path');

// MongoDB connection
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/recruitpro';

// Define schemas
const companySchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  website: String,
  status: String,
  createdAt: Date,
  updatedAt: Date,
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  email: String,
  role: String,
  companyId: mongoose.Schema.Types.ObjectId,
  firstName: String,
  lastName: String,
}, { timestamps: true });

const Company = mongoose.model('Company', companySchema);
const User = mongoose.model('User', userSchema);

async function assignDefaultCompany() {
  try {
    console.log('✅ Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find or create default company
    let defaultCompany = await Company.findOne({ email: 'company@recruitpro.com' });

    if (!defaultCompany) {
      console.log('📦 Creating default company...');
      defaultCompany = await Company.create({
        name: 'RecruirtPro Company',
        email: 'company@recruitpro.com',
        phone: '+91-9876543210',
        website: 'https://recruitpro.com',
        status: 'active',
        description: 'Default company for HR users',
        industry: 'Technology',
        size: '51-200',
      });
      console.log(`✅ Default company created: ${defaultCompany._id}\n`);
    } else {
      console.log(`✅ Default company found: ${defaultCompany._id}\n`);
    }

    // Find HR users without companyId
    const hrUsersWithoutCompany = await User.find({
      role: { $in: ['hr', 'employer', 'interviewer'] },
      companyId: { $exists: false },
      deletedAt: null,
    });

    console.log(`📧 Found ${hrUsersWithoutCompany.length} HR/Employer users without company`);

    if (hrUsersWithoutCompany.length === 0) {
      console.log('✅ All HR users already have a company assigned!\n');
      await mongoose.disconnect();
      return;
    }

    console.log('\n📝 Assigning default company to users:\n');
    
    for (const user of hrUsersWithoutCompany) {
      await User.updateOne(
        { _id: user._id },
        { $set: { companyId: defaultCompany._id } }
      );
      console.log(`✅ ${user.firstName} ${user.lastName} (${user.email}) → Company assigned`);
    }

    console.log('\n✅ All HR users now have a company assigned!');
    console.log('\nCompany Details:');
    console.log('================');
    console.log(`Name: ${defaultCompany.name}`);
    console.log(`ID: ${defaultCompany._id}`);
    console.log(`Email: ${defaultCompany.email}`);
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  assignDefaultCompany();
}

module.exports = { assignDefaultCompany };
