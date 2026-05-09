const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/recruitpro').then(async () => {
  // Companies
  const companies = await mongoose.connection.db.collection('companies').find({}).toArray();
  console.log('=== COMPANIES ===');
  companies.forEach(c => console.log(`  ${c._id} | ${c.name} | ${c.email}`));

  // Users (non-candidate)
  const users = await mongoose.connection.db.collection('users').find({
    role: { $in: ['admin', 'hr', 'employer', 'interviewer'] }
  }).toArray();
  console.log('\n=== USERS ===');
  users.forEach(u => console.log(`  ${u.email} | role=${u.role} | companyId=${u.companyId || 'NONE'}`));

  // Jobs
  const jobs = await mongoose.connection.db.collection('jobs').find({}).toArray();
  console.log('\n=== JOBS ===');
  jobs.forEach(j => console.log(`  "${j.title}" | companyId=${j.companyId} | createdBy=${j.createdBy}`));

  mongoose.disconnect();
});
