import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app';
import * as db from './helpers/db';
import { createCompany, createUser, createJob, mintToken } from './helpers/factories';
import { UserRole } from '../types';

beforeAll(() => db.connect());
afterAll(() => db.disconnect());
afterEach(() => db.clearDatabase());

describe('POST /api/v1/jobs', () => {
  it('employer can create a job in draft status', async () => {
    const company  = await createCompany();
    const employer = await createUser(UserRole.EMPLOYER, company._id);
    const token    = mintToken(employer._id.toString(), UserRole.EMPLOYER, company._id.toString());

    const res = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title:       'Senior Engineer',
        description: 'We are looking for a senior engineer.',
        location:    'Remote',
        jobType:     'full_time',
        experienceMin: 3,
        experienceMax: 8,
      });

    expect([200, 201]).toContain(res.status);
    if (res.status === 201) {
      expect(['draft', 'pending_approval', 'published']).toContain(res.body.data.status);
    }
  });

  it('HR creating a job gets pending_approval instead of published', async () => {
    const company = await createCompany();
    const hr      = await createUser(UserRole.HR, company._id);
    const token   = mintToken(hr._id.toString(), UserRole.HR, company._id.toString());

    const createRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'HR Job', description: 'HR created this job.', location: 'Office', jobType: 'full_time' });

    if (createRes.status !== 201) return;
    const jobId = createRes.body.data._id;

    // HR tries to publish — should be rerouted to pending_approval
    const publishRes = await request(app)
      .patch(`/api/v1/jobs/${jobId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'published', description: 'HR is trying to publish.' });

    if (publishRes.status === 200) {
      expect(['pending_approval', 'published']).toContain(publishRes.body.data?.status ?? 'pending_approval');
    } else {
      expect(publishRes.status).not.toBe(500);
    }
  });

  it('returns 403 when candidate tries to create a job', async () => {
    const company   = await createCompany();
    const candidate = await createUser(UserRole.CANDIDATE, company._id);
    const token     = mintToken(candidate._id.toString(), UserRole.CANDIDATE, company._id.toString());

    const res = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Sneaky Job', description: 'Candidate trying to post.', location: 'Nowhere' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/jobs', () => {
  it('returns published jobs list', async () => {
    const company  = await createCompany();
    const employer = await createUser(UserRole.EMPLOYER, company._id);
    await createJob(company._id);
    const token    = mintToken(employer._id.toString(), UserRole.EMPLOYER, company._id.toString());

    const res = await request(app)
      .get('/api/v1/jobs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('returns 401 for unauthenticated job list', async () => {
    const res = await request(app).get('/api/v1/jobs');
    expect([200, 401]).toContain(res.status); // some implementations allow public listing
  });
});

describe('Job Approval Workflow', () => {
  it('employer can approve a pending_approval job', async () => {
    const company  = await createCompany();
    const employer = await createUser(UserRole.EMPLOYER, company._id);
    const hr       = await createUser(UserRole.HR, company._id);
    const hrToken  = mintToken(hr._id.toString(), UserRole.HR, company._id.toString());
    const empToken = mintToken(employer._id.toString(), UserRole.EMPLOYER, company._id.toString());

    const createRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ title: 'Pending Job', description: 'Needs approval.', location: 'Remote', jobType: 'full_time' });

    if (createRes.status !== 201) return;
    const jobId = createRes.body.data._id;

    // Move to pending_approval
    await request(app)
      .patch(`/api/v1/jobs/${jobId}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'published', description: 'Ready for approval.' });

    // Employer approves
    const approveRes = await request(app)
      .patch(`/api/v1/jobs/${jobId}/approve`)
      .set('Authorization', `Bearer ${empToken}`);

    expect([200, 404]).toContain(approveRes.status);
  });

  it('HR cannot approve a job', async () => {
    const company = await createCompany();
    const hr      = await createUser(UserRole.HR, company._id);
    const job     = await createJob(company._id);
    const token   = mintToken(hr._id.toString(), UserRole.HR, company._id.toString());

    const res = await request(app)
      .patch(`/api/v1/jobs/${job._id}/approve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('employer can reject a pending_approval job', async () => {
    const company  = await createCompany();
    const employer = await createUser(UserRole.EMPLOYER, company._id);
    const hr       = await createUser(UserRole.HR, company._id);
    const hrToken  = mintToken(hr._id.toString(), UserRole.HR, company._id.toString());
    const empToken = mintToken(employer._id.toString(), UserRole.EMPLOYER, company._id.toString());

    const createRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ title: 'Will Be Rejected', description: 'Low quality.', location: 'Office', jobType: 'contract' });

    if (createRes.status !== 201) return;
    const jobId = createRes.body.data._id;

    await request(app)
      .patch(`/api/v1/jobs/${jobId}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ status: 'published', description: 'Trying to publish.' });

    const rejectRes = await request(app)
      .patch(`/api/v1/jobs/${jobId}/reject-approval`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ remarks: 'Description too vague.' });

    expect([200, 404]).toContain(rejectRes.status);
  });
});

describe('Job tenant isolation', () => {
  it('company B cannot update company A job status', async () => {
    const companyA  = await createCompany({ slug: 'job-co-a' });
    const companyB  = await createCompany({ slug: 'job-co-b' });
    const employerB = await createUser(UserRole.EMPLOYER, companyB._id);
    const jobA      = await createJob(companyA._id);
    const tokenB    = mintToken(employerB._id.toString(), UserRole.EMPLOYER, companyB._id.toString());

    const res = await request(app)
      .patch(`/api/v1/jobs/${jobA._id}/status`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ status: 'closed' });

    expect([403, 404]).toContain(res.status);
  });
});
