import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { User, Company, Offer, Application, Job } from '../../models';
import { UserRole, UserStatus, OfferStatus } from '../../types';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-min-32-chars-long-enough';

/** Mint a JWT for a user object (bypasses DB) */
export function mintToken(userId: string, role: UserRole, companyId?: string): string {
  return jwt.sign({ id: userId, email: 'test@test.com', role, companyId }, JWT_SECRET, {
    expiresIn: '1h',
  });
}

/** Create an active Company */
export async function createCompany(overrides: Record<string, any> = {}) {
  return Company.create({
    name: 'Test Corp',
    slug: `testcorp-${Date.now()}`,
    email: `hr-${Date.now()}@testcorp.com`,
    status: 'active',
    ...overrides,
  });
}

/** Create an active User */
export async function createUser(
  role: UserRole,
  companyId: string | mongoose.Types.ObjectId,
  overrides: Record<string, any> = {}
) {
  const ts = Date.now();
  return User.create({
    email:         `user-${ts}-${role}@test.com`,
    password:      'Password123!',
    firstName:     'Test',
    lastName:      'User',
    role,
    status:        UserStatus.ACTIVE,
    emailVerified: true,
    companyId,
    ...overrides,
  });
}

/** Create a Job for a company */
export async function createJob(companyId: string | mongoose.Types.ObjectId) {
  return Job.create({
    title:       'Software Engineer',
    description: 'Test job',
    companyId,
    status:      'published',
    jobType:     'full_time',
    workMode:    'remote',
    location:    'Remote',
    createdBy:   new mongoose.Types.ObjectId(),
  });
}

/** Create an Application */
export async function createApplication(
  candidateId: string | mongoose.Types.ObjectId,
  jobId: string | mongoose.Types.ObjectId,
  companyId: string | mongoose.Types.ObjectId
) {
  return Application.create({
    candidateId,
    jobId,
    companyId,
    status:    'applied',
    appliedAt: new Date(),
  });
}

/** Create an Offer for an application */
export async function createOffer(
  applicationId: string | mongoose.Types.ObjectId,
  candidateId: string | mongoose.Types.ObjectId,
  jobId: string | mongoose.Types.ObjectId,
  companyId: string | mongoose.Types.ObjectId,
  createdBy: string | mongoose.Types.ObjectId,
  status: OfferStatus = OfferStatus.SENT
) {
  return Offer.create({
    companyId,
    applicationId,
    jobId,
    candidateId,
    createdBy,
    status,
    salary:      { amount: 1_200_000, currency: 'INR', frequency: 'annual' },
    designation: 'Software Engineer',
    joiningDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    sentAt:      status === OfferStatus.SENT ? new Date() : undefined,
    statusHistory: [{ status, changedAt: new Date(), remarks: 'Test' }],
  });
}
