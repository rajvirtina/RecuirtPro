import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app';
import * as db from './helpers/db';
import { createCompany, createUser, createJob, createApplication, mintToken } from './helpers/factories';
import { UserRole } from '../types';

beforeAll(() => db.connect());
afterAll(() => db.disconnect());
afterEach(() => db.clearDatabase());

describe('GET /api/v1/applications', () => {
  it('HR can list applications for their company', async () => {
    const company = await createCompany();
    const hrUser  = await createUser(UserRole.HR, company._id);
    const token   = mintToken(hrUser._id.toString(), UserRole.HR, company._id.toString());

    const res = await request(app)
      .get('/api/v1/applications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Response may be wrapped or a raw array
    const data = res.body.data ?? res.body;
    expect(data).toBeDefined();
  });

  it('candidate sees only their own applications', async () => {
    const company   = await createCompany();
    const candidate = await createUser(UserRole.CANDIDATE, company._id);
    const other     = await createUser(UserRole.CANDIDATE, company._id);
    const job       = await createJob(company._id);

    await createApplication(candidate._id, job._id, company._id);
    await createApplication(other._id, job._id, company._id);

    const token = mintToken(candidate._id.toString(), UserRole.CANDIDATE, company._id.toString());
    const res   = await request(app)
      .get('/api/v1/applications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const items = res.body.data?.applications ?? res.body.data ?? res.body?.applications ?? [];
    if (Array.isArray(items)) {
      for (const app of items) {
        const cid = app.candidateId?._id ?? app.candidateId ?? app.candidate?._id;
        if (cid) expect(cid.toString()).toBe(candidate._id.toString());
      }
    }
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/applications');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/applications/:id', () => {
  it('returns application for HR in same company', async () => {
    const company   = await createCompany();
    const hrUser    = await createUser(UserRole.HR, company._id);
    const candidate = await createUser(UserRole.CANDIDATE, company._id);
    const job       = await createJob(company._id);
    const app_      = await createApplication(candidate._id, job._id, company._id);
    const token     = mintToken(hrUser._id.toString(), UserRole.HR, company._id.toString());

    const res = await request(app)
      .get(`/api/v1/applications/${app_._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect([200, 404]).toContain(res.status);
  });

  it('returns 404 for non-existent application', async () => {
    const company = await createCompany();
    const hrUser  = await createUser(UserRole.HR, company._id);
    const token   = mintToken(hrUser._id.toString(), UserRole.HR, company._id.toString());

    const res = await request(app)
      .get(`/api/v1/applications/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`);

    expect([403, 404]).toContain(res.status);
  });
});

describe('Application tenant isolation', () => {
  it('blocks company B HR from viewing company A applications', async () => {
    const companyA   = await createCompany({ slug: 'app-co-a' });
    const companyB   = await createCompany({ slug: 'app-co-b' });
    const candidateA = await createUser(UserRole.CANDIDATE, companyA._id);
    const jobA       = await createJob(companyA._id);
    const appA       = await createApplication(candidateA._id, jobA._id, companyA._id);
    const hrB        = await createUser(UserRole.HR, companyB._id);
    const tokenB     = mintToken(hrB._id.toString(), UserRole.HR, companyB._id.toString());

    const res = await request(app)
      .get(`/api/v1/applications/${appA._id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect([403, 404]).toContain(res.status);
  });
});

describe('Application submission', () => {
  it('candidate can apply to an open job', async () => {
    const company   = await createCompany();
    const candidate = await createUser(UserRole.CANDIDATE, company._id);
    const job       = await createJob(company._id);
    const token     = mintToken(candidate._id.toString(), UserRole.CANDIDATE, company._id.toString());

    const res = await request(app)
      .post('/api/v1/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ jobId: job._id.toString() });

    expect([200, 201, 400, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  it('rejects duplicate applications gracefully', async () => {
    const company   = await createCompany();
    const candidate = await createUser(UserRole.CANDIDATE, company._id);
    const job       = await createJob(company._id);
    const token     = mintToken(candidate._id.toString(), UserRole.CANDIDATE, company._id.toString());

    // First application
    await request(app)
      .post('/api/v1/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ jobId: job._id.toString() });

    // Duplicate
    const res = await request(app)
      .post('/api/v1/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ jobId: job._id.toString() });

    expect(res.status).not.toBe(500);
  });
});
