import request from 'supertest';
import app from '../app';
import * as db from './helpers/db';
import { createCompany, createUser, mintToken } from './helpers/factories';
import { UserRole } from '../types';

beforeAll(() => db.connect());
afterAll(() => db.disconnect());
afterEach(() => db.clearDatabase());

describe('POST /api/v1/auth/register', () => {
  it('registers a candidate with a valid company slug', async () => {
    const company = await createCompany({ slug: 'acme' });

    const res = await request(app).post('/api/v1/auth/register').send({
      email:       'alice@example.com',
      password:    'Password123!',
      firstName:   'Alice',
      lastName:    'Smith',
      role:        'candidate',
      companySlug: company.slug,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('candidate');
  });

  it('returns 400 when candidate registers without a company slug', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email:     'bob@example.com',
      password:  'Password123!',
      firstName: 'Bob',
      lastName:  'Jones',
      role:      'candidate',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/company code/i);
  });

  it('returns 400 for an invalid company slug', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email:       'eve@example.com',
      password:    'Password123!',
      firstName:   'Eve',
      lastName:    'Brown',
      role:        'candidate',
      companySlug: 'nonexistent-slug',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid company code/i);
  });

  it('returns 409 when email is already registered', async () => {
    const company = await createCompany({ slug: 'dupco' });
    await createUser(UserRole.CANDIDATE, company._id);

    const dupUser = await createUser(UserRole.CANDIDATE, company._id, {
      email: 'dup@example.com',
    });

    const res = await request(app).post('/api/v1/auth/register').send({
      email:       dupUser.email,
      password:    'Password123!',
      firstName:   'Dup',
      lastName:    'User',
      role:        'candidate',
      companySlug: company.slug,
    });

    expect(res.status).toBe(409);
  });

  it('blocks employer role registration without invitation', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email:     'hacker@example.com',
      password:  'Password123!',
      firstName: 'Bad',
      lastName:  'Actor',
      role:      'employer',
    });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/auth/login', () => {
  it('returns 200 with tokens for valid credentials', async () => {
    const company = await createCompany();
    const user    = await createUser(UserRole.HR, company._id, { email: 'hr@test.com' });

    const res = await request(app).post('/api/v1/auth/login').send({
      email:    user.email,
      password: 'Password123!',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data.user.role).toBe('hr');
  });

  it('returns 401 for wrong password', async () => {
    const company = await createCompany();
    const user    = await createUser(UserRole.HR, company._id, { email: 'hr2@test.com' });

    const res = await request(app).post('/api/v1/auth/login').send({
      email:    user.email,
      password: 'WrongPassword!',
    });

    expect(res.status).toBe(401);
  });

  it('returns 401 for non-existent user', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email:    'ghost@example.com',
      password: 'Password123!',
    });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns user profile for a valid token', async () => {
    const company = await createCompany();
    const user    = await createUser(UserRole.HR, company._id);
    const token   = mintToken(user._id.toString(), UserRole.HR, company._id.toString());

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(user.email);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a token signed with the wrong secret', async () => {
    const fakeToken = require('jsonwebtoken').sign(
      { id: 'fakeid', email: 'fake@test.com', role: 'hr' },
      'wrong-secret-key'
    );

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${fakeToken}`);

    expect(res.status).toBe(401);
  });
});
