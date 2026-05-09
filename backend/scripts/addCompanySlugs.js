/**
 * Migration Script: Add slug field to existing companies
 * 
 * This script generates unique slugs for companies that don't have one yet.
 * Run this after updating the Company model to include the slug field.
 * 
 * Usage: node backend/scripts/addCompanySlugs.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/recruitpro');
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Generate slug from company name
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();
};

// Ensure slug is unique
const ensureUniqueSlug = async (Company, baseSlug, excludeId = null) => {
  let slug = baseSlug;
  let counter = 1;
  
  while (true) {
    const query = { slug, deletedAt: null };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    
    const existing = await Company.findOne(query);
    if (!existing) {
      return slug;
    }
    
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

const addCompanySlugs = async () => {
  try {
    await connectDB();

    // Define Company schema inline since we can't import from TypeScript
    const companySchema = new mongoose.Schema({
      name: String,
      slug: String,
      email: String,
      deletedAt: Date
    }, { timestamps: true });
    
    // Get or define Company model
    let Company;
    try {
      Company = mongoose.model('Company');
    } catch {
      Company = mongoose.model('Company', companySchema);
    }

    // Find all companies without slugs
    const companies = await Company.find({
      $or: [
        { slug: { $exists: false } },
        { slug: null },
        { slug: '' }
      ],
      deletedAt: null
    });

    console.log(`\n📊 Found ${companies.length} companies without slugs\n`);

    if (companies.length === 0) {
      console.log('✅ All companies already have slugs. Nothing to do.');
      process.exit(0);
    }

    let updated = 0;
    let skipped = 0;

    for (const company of companies) {
      try {
        const baseSlug = generateSlug(company.name);
        const uniqueSlug = await ensureUniqueSlug(Company, baseSlug, company._id);

        // Update company with slug
        company.slug = uniqueSlug;
        await company.save({ validateBeforeSave: false }); // Skip validation in case of other missing required fields

        console.log(`✅ Updated: ${company.name} → ${uniqueSlug}`);
        updated++;
      } catch (error) {
        console.error(`❌ Error updating company ${company.name}:`, error.message);
        skipped++;
      }
    }

    console.log(`\n📈 Migration Summary:`);
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⚠️  Skipped: ${skipped}`);
    console.log(`   📊 Total: ${companies.length}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migration
addCompanySlugs();
