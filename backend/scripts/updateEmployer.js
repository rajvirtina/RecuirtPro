const mongoose = require('mongoose');

async function updateEmployerCompany() {
  try {
    await mongoose.connect('mongodb://localhost:27017/recruitpro');
    console.log('Connected to MongoDB');

    const ObjectId = mongoose.Types.ObjectId;
    const result = await mongoose.connection.db.collection('users').updateOne(
      { email: 'testemployer@demo.com' },
      { $set: { companyId: new ObjectId('507f1f77bcf86cd799439011') } }
    );

    console.log('Update result:', result);
    console.log('✅ Employer company ID updated!');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateEmployerCompany();
