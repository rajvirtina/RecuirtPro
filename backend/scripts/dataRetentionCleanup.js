/**
 * Data Retention Cleanup Script
 * Runs periodically to enforce data retention policies
 * Should be scheduled via cron job or task scheduler
 */

const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/recruitpro');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Cleanup old proctoring events (90 days)
async function cleanupProctoringEvents() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  try {
    const result = await mongoose.connection.db
      .collection('proctoringevents')
      .deleteMany({ createdAt: { $lt: cutoffDate } });

    console.log(`🗑️  Deleted ${result.deletedCount} proctoring events older than 90 days`);
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up proctoring events:', error);
    return 0;
  }
}

// Cleanup old audit logs (2 years)
async function cleanupAuditLogs() {
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);

  try {
    // Keep critical audit logs (login, deletion, etc.)
    const result = await mongoose.connection.db
      .collection('auditlogs')
      .deleteMany({
        createdAt: { $lt: cutoffDate },
        action: { $nin: ['LOGIN', 'ACCOUNT_DELETED', 'GDPR_DATA_EXPORT', 'PASSWORD_RESET'] },
      });

    console.log(`🗑️  Deleted ${result.deletedCount} audit logs older than 2 years`);
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up audit logs:', error);
    return 0;
  }
}

// Anonymize old applications (1 year after rejection/withdrawal)
async function anonymizeOldApplications() {
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);

  try {
    const result = await mongoose.connection.db
      .collection('applications')
      .updateMany(
        {
          updatedAt: { $lt: cutoffDate },
          status: { $in: ['rejected', 'withdrawn'] },
          'metadata.anonymized': { $ne: true },
        },
        {
          $set: {
            'metadata.anonymized': true,
            'metadata.anonymizedAt': new Date(),
          },
        }
      );

    console.log(`🔒 Anonymized ${result.modifiedCount} old applications`);
    return result.modifiedCount;
  } catch (error) {
    console.error('Error anonymizing applications:', error);
    return 0;
  }
}

// Cleanup expired rate limit logs
async function cleanupRateLimitLogs() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7); // 7 days

  try {
    const result = await mongoose.connection.db
      .collection('ratelimitlogs')
      .deleteMany({ createdAt: { $lt: cutoffDate } });

    console.log(`🗑️  Deleted ${result.deletedCount} rate limit logs older than 7 days`);
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up rate limit logs:', error);
    return 0;
  }
}

// Cleanup expired notifications (30 days)
async function cleanupNotifications() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  try {
    const result = await mongoose.connection.db
      .collection('notifications')
      .deleteMany({
        createdAt: { $lt: cutoffDate },
        read: true,
      });

    console.log(`🗑️  Deleted ${result.deletedCount} read notifications older than 30 days`);
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up notifications:', error);
    return 0;
  }
}

// Main cleanup function
async function runDataRetentionCleanup() {
  console.log('\n═══════════════════════════════════════');
  console.log('🧹 DATA RETENTION CLEANUP STARTED');
  console.log('═══════════════════════════════════════\n');
  console.log(`📅 Date: ${new Date().toISOString()}\n`);

  await connectDB();

  const stats = {
    proctoringEvents: 0,
    auditLogs: 0,
    applications: 0,
    rateLimitLogs: 0,
    notifications: 0,
  };

  try {
    // Run all cleanup tasks
    stats.proctoringEvents = await cleanupProctoringEvents();
    stats.auditLogs = await cleanupAuditLogs();
    stats.applications = await anonymizeOldApplications();
    stats.rateLimitLogs = await cleanupRateLimitLogs();
    stats.notifications = await cleanupNotifications();

    // Summary
    console.log('\n═══════════════════════════════════════');
    console.log('✅ CLEANUP SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Proctoring Events Deleted: ${stats.proctoringEvents}`);
    console.log(`Audit Logs Deleted: ${stats.auditLogs}`);
    console.log(`Applications Anonymized: ${stats.applications}`);
    console.log(`Rate Limit Logs Deleted: ${stats.rateLimitLogs}`);
    console.log(`Notifications Deleted: ${stats.notifications}`);
    console.log('═══════════════════════════════════════\n');

    // Log cleanup event
    await mongoose.connection.db.collection('auditlogs').insertOne({
      userId: new mongoose.Types.ObjectId('000000000000000000000000'), // System user
      userEmail: 'system@recruitpro.com',
      action: 'DATA_RETENTION_CLEANUP',
      resourceType: 'system',
      details: {
        timestamp: new Date(),
        stats,
      },
      createdAt: new Date(),
    });

    console.log('✅ Data retention cleanup completed successfully\n');
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📴 Disconnected from MongoDB\n');
  }
}

// Run cleanup
runDataRetentionCleanup();
