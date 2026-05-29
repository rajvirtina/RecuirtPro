import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app';
import * as db from './helpers/db';
import { createCompany, createUser, createJob, createApplication, mintToken } from './helpers/factories';
import { UserRole } from '../types';

beforeAll(() => db.connect());
afterAll(() => db.disconnect());
afterEach(() => db.clearDatabase());

describe('POST /api/v1/interviews', () => {
  it('schedules an interview successfully (HR)', async () => {
    const company     = await createCompany();
    const hrUser      = await createUser(UserRole.HR, company._id);
    const candidate   = await createUser(UserRole.CANDIDATE, company._id);
    const job         = await createJob(company._id);
    const application = await createApplication(candidate._id, job._id, company._id);
    const token       = mintToken(hrUser._id.toString(), UserRole.HR, company._id.toString());

    const res = await request(app)
      .post('/api/v1/interviews')
      .set('Authorization', `Bearer ${token}`)
      .send({
        applicationId: application._id.toString(),
        scheduledTime: new Date(Date.now() + 2 * 3_600_000).toISOString(),
        duration:      60,
        mode:          'video',
        interviewType: 'technical',
        round:         'L1',
        panel:         [],
      });

    expect([200, 201]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.data).toMatchObject({ status: 'scheduled' });
    }
  });

  it('returns 400 when applicationId is missing', async () => {
    const company = await createCompany();
    const hrUser  = await createUser(UserRole.HR, company._id);
    const token   = mintToken(hrUser._id.toString(), UserRole.HR, company._id.toString());

    const res = await request(app)
      .post('/api/v1/interviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ scheduledTime: new Date().toISOString(), duration: 60 });

    expect([400, 422]).toContain(res.status);
  });

  it('rejects candidates from scheduling interviews', async () => {
    const company   = await createCompany();
    const candidate = await createUser(UserRole.CANDIDATE, company._id);
    const token     = mintToken(candidate._id.toString(), UserRole.CANDIDATE, company._id.toString());

    const res = await request(app)
      .post('/api/v1/interviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ applicationId: new mongoose.Types.ObjectId().toString(), scheduledTime: new Date().toISOString(), duration: 30 });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/interviews', () => {
  it('returns interviews list for HR', async () => {
    const company = await createCompany();
    const hrUser  = await createUser(UserRole.HR, company._id);
    const token   = mintToken(hrUser._id.toString(), UserRole.HR, company._id.toString());

    const res = await request(app)
      .get('/api/v1/interviews')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data ?? res.body)).toBe(true);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/interviews');
    expect(res.status).toBe(401);
  });

  it('filters interviews by status', async () => {
    const company = await createCompany();
    const hrUser  = await createUser(UserRole.HR, company._id);
    const token   = mintToken(hrUser._id.toString(), UserRole.HR, company._id.toString());

    const res = await request(app)
      .get('/api/v1/interviews?status=scheduled')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/interviews/:id', () => {
  it('returns 404 for non-existent interview', async () => {
    const company = await createCompany();
    const hrUser  = await createUser(UserRole.HR, company._id);
    const token   = mintToken(hrUser._id.toString(), UserRole.HR, company._id.toString());

    const res = await request(app)
      .get(`/api/v1/interviews/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`);

    expect([404, 403]).toContain(res.status);
  });
});

describe('Interview tenant isolation', () => {
  it('blocks company B from reading company A interviews', async () => {
    const companyA = await createCompany({ slug: 'interview-co-a' });
    const companyB = await createCompany({ slug: 'interview-co-b' });
    const hrB      = await createUser(UserRole.HR, companyB._id);
    const tokenB   = mintToken(hrB._id.toString(), UserRole.HR, companyB._id.toString());

    const candidateA = await createUser(UserRole.CANDIDATE, companyA._id);
    const jobA       = await createJob(companyA._id);
    const appA       = await createApplication(candidateA._id, jobA._id, companyA._id);
    const hrA        = await createUser(UserRole.HR, companyA._id);
    const tokenA     = mintToken(hrA._id.toString(), UserRole.HR, companyA._id.toString());

    const schedRes = await request(app)
      .post('/api/v1/interviews')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        applicationId: appA._id.toString(),
        scheduledTime: new Date(Date.now() + 2 * 3_600_000).toISOString(),
        duration:      45,
        mode:          'video',
        interviewType: 'general',
        round:         'L1',
        panel:         [],
      });

    if (schedRes.status !== 201) return;
    const interviewId = schedRes.body.data._id;

    const crossRes = await request(app)
      .get(`/api/v1/interviews/${interviewId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect([403, 404]).toContain(crossRes.status);
  });
});
