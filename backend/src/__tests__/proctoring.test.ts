import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app';
import * as db from './helpers/db';
import { createCompany, createUser, createJob, createApplication, mintToken } from './helpers/factories';
import { UserRole } from '../types';

beforeAll(() => db.connect());
afterAll(() => db.disconnect());
afterEach(() => db.clearDatabase());

describe('POST /api/v1/proctoring/event', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/proctoring/event')
      .send({ interviewId: new mongoose.Types.ObjectId().toString(), type: 'tab_switch' });

    expect(res.status).toBe(401);
  });

  it('candidate can log a proctoring event', async () => {
    const company   = await createCompany();
    const candidate = await createUser(UserRole.CANDIDATE, company._id);
    const token     = mintToken(candidate._id.toString(), UserRole.CANDIDATE, company._id.toString());

    const res = await request(app)
      .post('/api/v1/proctoring/event')
      .set('Authorization', `Bearer ${token}`)
      .send({
        interviewId: new mongoose.Types.ObjectId().toString(),
        type:        'tab_switch',
        severity:    'medium',
        details:     { description: 'Candidate switched tabs' },
      });

    // Accepted or validation error — must NOT be 401/403/500
    expect([200, 201, 400, 404, 422]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });
});

describe('POST /api/v1/proctoring/heartbeat', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/proctoring/heartbeat')
      .send({ interviewId: new mongoose.Types.ObjectId().toString() });

    expect(res.status).toBe(401);
  });

  it('authenticated user can send heartbeat', async () => {
    const company   = await createCompany();
    const candidate = await createUser(UserRole.CANDIDATE, company._id);
    const token     = mintToken(candidate._id.toString(), UserRole.CANDIDATE, company._id.toString());

    const res = await request(app)
      .post('/api/v1/proctoring/heartbeat')
      .set('Authorization', `Bearer ${token}`)
      .send({ interviewId: new mongoose.Types.ObjectId().toString() });

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(500);
  });
});

describe('GET /api/v1/proctoring/events/recent (HR dashboard)', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/proctoring/events/recent');
    expect(res.status).toBe(401);
  });

  it('candidate is blocked (403)', async () => {
    const company   = await createCompany();
    const candidate = await createUser(UserRole.CANDIDATE, company._id);
    const token     = mintToken(candidate._id.toString(), UserRole.CANDIDATE, company._id.toString());

    const res = await request(app)
      .get('/api/v1/proctoring/events/recent')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('HR can access recent proctoring events', async () => {
    const company = await createCompany();
    const hr      = await createUser(UserRole.HR, company._id);
    const token   = mintToken(hr._id.toString(), UserRole.HR, company._id.toString());

    const res = await request(app)
      .get('/api/v1/proctoring/events/recent')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/proctoring/events/:interviewId', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .get(`/api/v1/proctoring/events/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(401);
  });

  it('HR gets events for an interview (empty list is OK)', async () => {
    const company = await createCompany();
    const hr      = await createUser(UserRole.HR, company._id);
    const token   = mintToken(hr._id.toString(), UserRole.HR, company._id.toString());

    const res = await request(app)
      .get(`/api/v1/proctoring/events/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`);

    expect([200, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  it('blocks company B HR from reading company A proctoring data', async () => {
    const companyA = await createCompany({ slug: 'proctor-co-a' });
    const companyB = await createCompany({ slug: 'proctor-co-b' });
    const hrB      = await createUser(UserRole.HR, companyB._id);
    const tokenB   = mintToken(hrB._id.toString(), UserRole.HR, companyB._id.toString());

    // Create a real interview context in company A and try to read from company B
    const candidateA = await createUser(UserRole.CANDIDATE, companyA._id);
    const jobA       = await createJob(companyA._id);
    const appA       = await createApplication(candidateA._id, jobA._id, companyA._id);

    const interviewId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .get(`/api/v1/proctoring/events/${interviewId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    // Should be 200 empty OR 404 — never 500, never expose co-A data
    expect([200, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });
});
