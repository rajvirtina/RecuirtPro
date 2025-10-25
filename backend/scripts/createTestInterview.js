const mongoose = require('mongoose');

async function createTestInterview() {
  try {
    await mongoose.connect('mongodb://localhost:27017/recruitpro');
    console.log('Connected to MongoDB\n');

    // Get a user (admin or employer)
    const user = await mongoose.connection.db.collection('users').findOne({ 
      role: { $in: ['admin', 'employer'] } 
    });
    
    if (!user) {
      console.log('❌ No admin or employer user found. Please create one first.');
      await mongoose.disconnect();
      process.exit(1);
    }

    // Get a job
    let job = await mongoose.connection.db.collection('jobs').findOne();
    
    if (!job) {
      console.log('Creating a test job...');
      job = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Test Software Developer Position',
        description: 'This is a test job for interview proctoring',
        companyId: user.companyId || new mongoose.Types.ObjectId(),
        employerId: user._id,
        status: 'active',
        location: 'Remote',
        salary: { min: 50000, max: 80000 },
        experienceLevel: 'mid',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await mongoose.connection.db.collection('jobs').insertOne(job);
      console.log('✅ Test job created');
    }

    // Get a candidate
    let candidate = await mongoose.connection.db.collection('users').findOne({ role: 'candidate' });
    
    if (!candidate) {
      console.log('Creating a test candidate...');
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('Test@123', 10);
      
      candidate = {
        _id: new mongoose.Types.ObjectId(),
        email: 'testcandidate@test.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'Candidate',
        role: 'candidate',
        status: 'active',
        emailVerified: true,
        phoneVerified: false,
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await mongoose.connection.db.collection('users').insertOne(candidate);
      console.log('✅ Test candidate created');
    }

    // Create or find an application
    let application = await mongoose.connection.db.collection('applications').findOne({ 
      candidateId: candidate._id,
      jobId: job._id 
    });

    if (!application) {
      console.log('Creating test application...');
      application = {
        _id: new mongoose.Types.ObjectId(),
        jobId: job._id,
        candidateId: candidate._id,
        companyId: job.companyId,
        status: 'shortlisted',
        appliedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await mongoose.connection.db.collection('applications').insertOne(application);
      console.log('✅ Test application created');
    }

    // Create test interview
    const interview = {
      _id: new mongoose.Types.ObjectId(),
      jobId: job._id,
      candidateId: candidate._id,
      companyId: job.companyId,
      applicationId: application._id,
      interviewers: [user._id],
      createdBy: user._id,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      duration: 60,
      status: 'scheduled',
      proctoringEnabled: true,
      round: 'technical', // Valid enum value: 'L1', 'L2', 'L3', 'HR', 'technical', 'managerial'
      roundNumber: 1,
      interviewType: 'technical',
      title: 'Technical Interview Round 1',
      description: 'Technical screening interview',
      meetingLink: 'https://meet.example.com/test-interview',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await mongoose.connection.db.collection('interviews').insertOne(interview);

    console.log('\n✅ Test Interview Created Successfully!\n');
    console.log('Interview Details:');
    console.log('==================');
    console.log('Interview ID:', interview._id.toString());
    console.log('Candidate:', candidate.firstName, candidate.lastName, `(${candidate.email})`);
    console.log('Job:', job.title);
    console.log('Status:', interview.status);
    console.log('Proctoring:', interview.proctoringEnabled ? 'Enabled ✅' : 'Disabled');
    console.log('\n📋 Use this URL to test:');
    console.log(`http://localhost:3000/proctoring-check/${interview._id.toString()}`);
    console.log('\n💡 Credentials:');
    console.log('Email:', candidate.email);
    console.log('Password: Test@123');
    console.log('\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createTestInterview();
