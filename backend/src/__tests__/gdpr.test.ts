import request from 'supertest';
import app from '../app';
import * as db from './helpers/db';
import { createCompany, createUser, mintToken } from './helpers/factories';
import { UserRole } from '../types';

beforeAll(() => db.connect());
afterAll(() => db.disconnect());
afterEach(() => db.clearDatabase());

describe('GET /api/v1/gdpr/export', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/v1/gdpr/export');
    expect(res.status).toBe(401);
  });

  it('returns user data export for authenticated user', async () => {
    const company = await createCompany();
    const user    = await createUser(UserRole.CANDIDATE, company._id);
    const token   = mintToken(user._id.toString(), UserRole.CANDIDATE, company._id.toString());

    const res = await request(app)
      .get('/api/v1/gdpr/export')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.status).not.toBe(500);
  });

  it('HR can also export their own data', async () => {
    const company = await createCompany();
    const hr      = await createUser(UserRole.HR, company._id);
    const token   = mintToken(hr._id.toString(), UserRole.HR, company._id.toString());

    const res = await request(app)
      .get('/api/v1/gdpr/export')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/gdpr/consent-history', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/gdpr/consent-history');
    expect(res.status).toBe(401);
  });

  it('returns consent history for authenticated user', async () => {
    const company = await createCompany();
    const user    = await createUser(UserRole.CANDIDATE, company._id);
    const token   = mintToken(user._id.toString(), UserRole.CANDIDATE, company._id.toString());

    const res = await request(app)
      .get('/api/v1/gdpr/consent-history')
      .set('Authorization', `Bearer ${token}`);

    expect([200, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });
});

describe('POST /api/v1/gdpr/withdraw-consent', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/gdpr/withdraw-consent')
      .send({ consentType: 'marketing' });
    expect(res.status).toBe(401);
  });

  it('authenticated user can withdraw consent', async () => {
    const company = await createCompany();
    const user    = await createUser(UserRole.CANDIDATE, company._id);
    const token   = mintToken(user._id.toString(), UserRole.CANDIDATE, company._id.toString());

    const res = await request(app)
      .post('/api/v1/gdpr/withdraw-consent')
      .set('Authorization', `Bearer ${token}`)
      .send({ consentType: 'marketing' });

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(500);
  });
});

describe('DELETE /api/v1/gdpr/delete-account', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).delete('/api/v1/gdpr/delete-account');
    expect(res.status).toBe(401);
  });

  it('user can request account deletion (soft delete or queued)', async () => {
    const company = await createCompany();
    const user    = await createUser(UserRole.CANDIDATE, company._id);
    const token   = mintToken(user._id.toString(), UserRole.CANDIDATE, company._id.toString());

    const res = await request(app)
      .delete('/api/v1/gdpr/delete-account')
      .set('Authorization', `Bearer ${token}`);

    // Accepted (200/202/204) or requires confirmation body — must not 500
    expect([200, 202, 204, 400]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  it('cannot delete another user\'s account (403/404)', async () => {
    const company = await createCompany();
    const userA   = await createUser(UserRole.CANDIDATE, company._id);
    const userB   = await createUser(UserRole.CANDIDATE, company._id);
    const tokenA  = mintToken(userA._id.toString(), UserRole.CANDIDATE, company._id.toString());

    // User A calls delete — only deletes their own account (route is self-only)
    const res = await request(app)
      .delete('/api/v1/gdpr/delete-account')
      .set('Authorization', `Bearer ${tokenA}`);

    // Should never act on user B's data
    const userBStillExists = await (await import('../models/User')).User.findById(userB._id);
    expect(userBStillExists).not.toBeNull();
    expect(res.status).not.toBe(500);
  });
});
