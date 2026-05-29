/**
 * RBAC + Tenant Isolation tests.
 *
 * Verifies:
 *  - Role-based access: only authorised roles can reach protected routes
 *  - Tenant isolation: company A cannot read company B's data
 */
import request from 'supertest';
import app from '../app';
import * as db from './helpers/db';
import {
  createCompany,
  createUser,
  mintToken,
  createJob,
  createApplication,
  createOffer,
} from './helpers/factories';
import { UserRole, OfferStatus } from '../types';

beforeAll(() => db.connect());
afterAll(() => db.disconnect());
afterEach(() => db.clearDatabase());

// ── Role-based access ─────────────────────────────────────────────────────────

describe('RBAC — /api/v1/admin', () => {
  it('allows super admin (no companyId) to reach admin routes', async () => {
    // Super admin: role=admin, companyId=undefined
    const adminToken = mintToken('000000000000000000000001', UserRole.ADMIN, undefined);

    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    // 200 or 404 (route may not exist) — never 403
    expect(res.status).not.toBe(403);
  });

  it('blocks HR from admin routes', async () => {
    const company  = await createCompany();
    const hr       = await createUser(UserRole.HR, company._id);
    const hrToken  = mintToken(hr._id.toString(), UserRole.HR, company._id.toString());

    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(403);
  });

  it('blocks CANDIDATE from admin routes', async () => {
    const company        = await createCompany();
    const candidate      = await createUser(UserRole.CANDIDATE, company._id);
    const candidateToken = mintToken(
      candidate._id.toString(),
      UserRole.CANDIDATE,
      company._id.toString()
    );

    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${candidateToken}`);

    expect(res.status).toBe(403);
  });
});

describe('RBAC — /api/v1/jobs (POST)', () => {
  it('allows HR to create a job', async () => {
    const company = await createCompany();
    const hr      = await createUser(UserRole.HR, company._id);
    const token   = mintToken(hr._id.toString(), UserRole.HR, company._id.toString());

    const res = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title:       'Test Role',
        description: 'Desc',
        jobType:     'full_time',
        workMode:    'remote',
        location:    'Remote',
        requirements: [],
      });

    expect([201, 400]).toContain(res.status); // 400 if validation fails — never 403
    expect(res.status).not.toBe(403);
  });

  it('blocks CANDIDATE from creating a job', async () => {
    const company   = await createCompany();
    const candidate = await createUser(UserRole.CANDIDATE, company._id);
    const token     = mintToken(
      candidate._id.toString(),
      UserRole.CANDIDATE,
      company._id.toString()
    );

    const res = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Hack', description: 'x', jobType: 'full_time' });

    expect(res.status).toBe(403);
  });
});

// ── Tenant isolation ──────────────────────────────────────────────────────────

describe('Tenant isolation — offers', () => {
  it('prevents company A HR from reading company B offer', async () => {
    const companyA = await createCompany({ slug: 'company-a', name: 'Company A' });
    const companyB = await createCompany({ slug: 'company-b', name: 'Company B' });

    const hrA       = await createUser(UserRole.HR, companyA._id);
    const hrB       = await createUser(UserRole.HR, companyB._id);
    const candidate = await createUser(UserRole.CANDIDATE, companyB._id);
    const job       = await createJob(companyB._id);
    const app_      = await createApplication(candidate._id, job._id, companyB._id);
    const offer     = await createOffer(
      app_._id, candidate._id, job._id, companyB._id, hrB._id
    );

    // HR from company A tries to GET company B's offer
    const tokenA = mintToken(hrA._id.toString(), UserRole.HR, companyA._id.toString());

    const res = await request(app)
      .get(`/api/v1/offers/${offer._id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect([403, 404]).toContain(res.status);
  });

  it('allows company B HR to read their own offer', async () => {
    const companyB  = await createCompany({ slug: 'company-b2', name: 'Company B2' });
    const hrB       = await createUser(UserRole.HR, companyB._id);
    const candidate = await createUser(UserRole.CANDIDATE, companyB._id);
    const job       = await createJob(companyB._id);
    const app_      = await createApplication(candidate._id, job._id, companyB._id);
    const offer     = await createOffer(
      app_._id, candidate._id, job._id, companyB._id, hrB._id
    );

    const tokenB = mintToken(hrB._id.toString(), UserRole.HR, companyB._id.toString());

    const res = await request(app)
      .get(`/api/v1/offers/${offer._id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
  });

  it('allows a candidate to read their own offer', async () => {
    const company   = await createCompany({ slug: 'co-cand' });
    const hr        = await createUser(UserRole.HR, company._id);
    const candidate = await createUser(UserRole.CANDIDATE, company._id);
    const job       = await createJob(company._id);
    const app_      = await createApplication(candidate._id, job._id, company._id);
    const offer     = await createOffer(
      app_._id, candidate._id, job._id, company._id, hr._id
    );

    const token = mintToken(
      candidate._id.toString(),
      UserRole.CANDIDATE,
      company._id.toString()
    );

    const res = await request(app)
      .get(`/api/v1/offers/${offer._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('prevents a candidate from reading another candidate\'s offer', async () => {
    const company    = await createCompany({ slug: 'co-two-cands' });
    const hr         = await createUser(UserRole.HR, company._id);
    const candidate1 = await createUser(UserRole.CANDIDATE, company._id);
    const candidate2 = await createUser(UserRole.CANDIDATE, company._id);
    const job        = await createJob(company._id);
    const app_       = await createApplication(candidate1._id, job._id, company._id);

    // Offer is for candidate1
    const offer = await createOffer(
      app_._id, candidate1._id, job._id, company._id, hr._id
    );

    // candidate2 tries to read candidate1's offer
    const token2 = mintToken(
      candidate2._id.toString(),
      UserRole.CANDIDATE,
      company._id.toString()
    );

    const res = await request(app)
      .get(`/api/v1/offers/${offer._id}`)
      .set('Authorization', `Bearer ${token2}`);

    expect([403, 404]).toContain(res.status);
  });
});
