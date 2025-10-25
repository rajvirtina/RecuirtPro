/**
 * Script to resend invitation and display the plain token
 * Usage: node scripts/resendInvitation.js <email>
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/recruitpro';

async function resendInvitation(email) {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const User = mongoose.connection.db.collection('users');
    
    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.error('❌ User not found:', email);
      process.exit(1);
    }

    console.log('\n📧 User found:', email);
    console.log('Status:', user.status);
    console.log('Role:', user.role);

    // Generate new invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(invitationToken).digest('hex');

    // Update user with new token
    const result = await User.updateOne(
      { email: email.toLowerCase() },
      {
        $set: {
          emailVerificationToken: hashedToken,
          emailVerificationExpires: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log('\n✅ Invitation token regenerated successfully!');
      console.log('\n' + '='.repeat(80));
      console.log('🔗 INVITATION URL (valid for 48 hours):');
      console.log('');
      
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const invitationUrl = `${frontendUrl}/complete-registration?token=${invitationToken}`;
      
      console.log(invitationUrl);
      console.log('');
      console.log('='.repeat(80));
      console.log('\n📋 Copy the URL above and open it in your browser to complete registration.');
      console.log('');
      console.log('Token details:');
      console.log('  Plain token (use this in URL):', invitationToken);
      console.log('  Hashed token (stored in DB):', hashedToken);
      console.log('  Expires:', new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString());
    } else {
      console.error('❌ Failed to update user');
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/resendInvitation.js <email>');
  console.error('Example: node scripts/resendInvitation.js rajkumarbalakatakam@gmail.com');
  process.exit(1);
}

resendInvitation(email);
