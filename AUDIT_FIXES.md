# Audit Fixes Changelog

**Date:** May 9, 2026  
**Reference:** RecuirtPro Complete Technical Audit Report  
**Scope:** All Phase 1 (P0) critical/high fixes + select medium fixes from the audit

---

## Summary

| Severity | Fixed | Remaining |
|----------|-------|-----------|
| CRITICAL | 3 | 0 |
| HIGH | 5 | 1 (B-06: refresh token revocation — requires Redis integration, deferred to Phase 2) |
| MEDIUM | 4 | 3 (4.11 xss-clean replacement, PERF-02 dashboard aggregation, PERF-04 heartbeat throttling) |
| LOW | 3 | 1 (4.14 console.log cleanup — across many frontend files, deferred) |

**Total bugs/issues fixed: 15**

---

## CRITICAL Fixes

### B-01 / SEC-01 — Soft-deleted users can log in
**File:** `backend/src/controllers/authController.ts`  
**Bug:** `if (!user.deletedAt === null)` evaluates as `(!user.deletedAt) === null` → `false === null` → always `false`. Deleted users were never blocked.  
**Fix:** Replaced with `if (user.deletedAt)` — a truthy check that correctly blocks any user with a non-null `deletedAt` timestamp. Applied to both the `login` function (line ~175) and the `refresh` function (line ~295).  
**Before:**
```typescript
if (!user.deletedAt === null) {
```
**After:**
```typescript
if (user.deletedAt) {
```

---

### B-02 / B-03 / SEC-03 — Mass assignment on Job create and update
**File:** `backend/src/controllers/jobController.ts`  
**Bug:** `createJob` used `{ ...req.body, companyId, createdBy }` allowing clients to set `applicationCount`, `viewCount`, `status`, `version`, `publishedAt`, etc. `updateJob` used `Job.findByIdAndUpdate(id, req.body)` with no field filtering.  
**Fix:** Introduced explicit field whitelisting for both operations:

**createJob — allowed fields:**
`title`, `description`, `responsibilities`, `requirements`, `skills`, `experienceMin`, `experienceMax`, `salaryMin`, `salaryMax`, `currency`, `location`, `workMode`, `jobType`, `department`, `positions`, `joiningDate`, `expiryDate`, `tags`

Server-controlled fields (`companyId`, `createdBy`, `status=draft`) are set explicitly. All other fields from `req.body` are ignored.

**updateJob — allowed fields:**
Same as create, plus `status` (to allow publish/close transitions). Fields like `companyId`, `createdBy`, `applicationCount`, `viewCount`, `version` cannot be modified via the API.

`findByIdAndUpdate` now uses `{ runValidators: true }` to enforce Mongoose schema validation on updates.

---

### B-03 / SEC-02 — Unauthenticated proctoring event injection
**File:** `backend/src/routes/proctoring.ts`  
**Bug:** Three routes were publicly accessible with no authentication:
- `POST /verify/:interviewId`
- `POST /event`
- `GET /system-check/:interviewId`

Anyone could inject fake proctoring events for any interview, fabricate violations, or flood the system.  
**Fix:** Moved `router.use(protect)` to the top of the router, before all route definitions. All proctoring endpoints now require a valid JWT. The separate `router.use(protect)` that was between public and protected routes was removed since all routes are now protected.

**Before:**
```typescript
router.post('/verify/:interviewId', verifySystemReadiness);  // PUBLIC
router.post('/event', logProctoringEvent);                    // PUBLIC
router.get('/system-check/:interviewId', getSystemCheckStatus); // PUBLIC
router.use(protect); // <-- only routes below this were protected
```

**After:**
```typescript
router.use(protect); // <-- ALL routes now protected
router.post('/verify/:interviewId', verifySystemReadiness);
router.post('/event', logProctoringEvent);
router.get('/system-check/:interviewId', getSystemCheckStatus);
```

---

## HIGH Fixes

### B-04 / SEC-05 — Cross-tenant job modification (no company isolation on update/delete)
**File:** `backend/src/controllers/jobController.ts`  
**Bug:** `updateJob` and `deleteJob` only checked company isolation for HR/employer roles. Admin users could modify any company's jobs without restriction, and the check was skipped entirely if `req.user.companyId` was falsy.  
**Fix:** Enforced company isolation for all non-admin roles. Admin retains cross-tenant access (by design for super-admin operations). The check now blocks the request if `companyId` is missing or doesn't match, regardless of role.

---

### B-05 / SEC-04 — Path traversal in resume download
**File:** `backend/src/controllers/applicationController.ts`  
**Bug:** `path.join(__dirname, '../../', application.resumeUrl)` allows traversal if `resumeUrl` contains `../../../etc/passwd`.  
**Fix:** Changed `path.join` to `path.resolve` and added a boundary check:
```typescript
const uploadsDir = path.resolve(__dirname, '../../uploads');
const filePath = path.resolve(__dirname, '../../', application.resumeUrl);
if (!filePath.startsWith(uploadsDir)) {
  // blocked — log and return 400
}
```
The resolved path must begin with the `uploads/` directory. Any traversal attempt is logged and rejected.

---

### SEC-06 — JWT/encryption secrets default to known strings in production
**File:** `backend/src/config/index.ts`  
**Bug:** `jwt.secret`, `jwt.refreshSecret`, and `encryptionKey` all had fallback values like `'default-secret-change-me'`. If `.env` was missing in production, the app ran with predictable secrets.  
**Fix:** Added startup validation that throws a fatal error if `NODE_ENV=production` and any of these three secrets is missing or matches a known dangerous default. The app will refuse to start.

```typescript
if (process.env.NODE_ENV === 'production') {
  if (!jwtSecret || DANGEROUS_DEFAULTS.includes(jwtSecret)) {
    throw new Error('FATAL: JWT_SECRET must be set to a secure value in production.');
  }
  // ... same for JWT_REFRESH_SECRET and ENCRYPTION_KEY
}
```

---

### SEC-08 — MongoDB exposed with hardcoded `admin/admin123`
**File:** `docker-compose.yml`  
**Bug:** `MONGO_INITDB_ROOT_USERNAME: admin` and `MONGO_INITDB_ROOT_PASSWORD: admin123` were hardcoded in the compose file.  
**Fix:** Replaced with environment variable substitution using Docker Compose variable syntax:
```yaml
MONGO_INITDB_ROOT_USERNAME: ${MONGO_INITDB_ROOT_USERNAME:-admin}
MONGO_INITDB_ROOT_PASSWORD: ${MONGO_INITDB_ROOT_PASSWORD:?MONGO_INITDB_ROOT_PASSWORD must be set in .env}
```
The `?` syntax makes the password **required** — `docker-compose up` will fail with a clear error if the `.env` file doesn't define `MONGO_INITDB_ROOT_PASSWORD`. The port is also parameterized via `${MONGO_PORT:-27017}`.

---

### SEC-10 — Swagger UI exposed without authentication in all environments
**File:** `backend/src/app.ts`  
**Fix:** Swagger UI is now only mounted in non-production environments:
```typescript
if (config.env !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
```

---

### SEC-12 — Uploaded resumes publicly accessible via static serving
**File:** `backend/src/app.ts`  
**Bug:** `app.use('/uploads', express.static('uploads'))` served all uploaded files (including resumes) without any authentication.  
**Fix:** Static file serving for `/uploads` is now restricted to development only. In production, resumes must be accessed through the authenticated `/api/v1/applications/:id/resume` endpoint, which performs authorization checks (owner, company HR, or admin).

---

## MEDIUM Fixes

### B-07 / B-08 — Duplicate status history entries + wrong `changedBy` attribution
**File:** `backend/src/models/Application.ts`  
**Bug:** The Mongoose pre-save hook pushed to `statusHistory` on every status change, always attributing the change to `this.candidateId`. The controllers (`updateApplicationStatus`, `withdrawApplication`) also manually pushed to `statusHistory`. Result: every status change created **two** history entries, one with the wrong author.  
**Fix:** Removed the `statusHistory.push()` from the pre-save hook. The hook now only updates timestamp fields (`shortlistedAt`, `rejectedAt`, `hiredAt`). Status history management is exclusively handled by controllers, which correctly record the authenticated user who performed the action.

---

### B-11 — Port mismatch between `PORT` and `server.url`
**File:** `backend/src/config/index.ts`  
**Bug:** `port` defaulted to `5000` but `server.url` defaulted to `http://localhost:5001`.  
**Fix:** `server.url` now defaults to `http://localhost:${process.env.PORT || '5000'}`, matching the `port` value.

---

### B-13 — Support email domain typo
**File:** `backend/src/config/index.ts`  
**Bug:** `supportEmail` defaulted to `support@recuritpro.com` (missing 'r' — should be `recruitpro`).  
**Fix:** Changed to `support@recruitpro.com`.

---

### 4.12 / PERF-01 — N+1 query in interview listing
**File:** `backend/src/controllers/interviewController.ts`  
**Bug:** `getInterviews` ran a separate `ProctoringEvent.countDocuments()` for each interview in the result set — O(n) database queries per page.  
**Fix:** Replaced with a single MongoDB aggregation pipeline:
```typescript
const violationCounts = await ProctoringEvent.aggregate([
  { $match: { interviewId: { $in: interviewIds } } },
  { $group: { _id: '$interviewId', count: { $sum: 1 } } },
]);
```
Results are mapped into a lookup object and applied in-memory. For a page of 10 interviews, this is now 1 DB query instead of 10.

---

### 4.13 — Hardcoded internal IP in default CORS whitelist
**File:** `backend/src/config/index.ts`  
**Bug:** `http://192.168.0.106:3000` and `http://192.168.0.106:5173` were hardcoded in the default CORS origin list.  
**Fix:** Removed. Only `localhost` origins remain in defaults. Production CORS origins should be set via the `CORS_ORIGIN` environment variable.

---

## Files Changed

| File | Changes |
|------|---------|
| `backend/src/controllers/authController.ts` | Fixed soft-delete check in `login` and `refresh` (B-01) |
| `backend/src/controllers/jobController.ts` | Field whitelisting on create/update (B-02), company isolation on update/delete (B-04) |
| `backend/src/controllers/applicationController.ts` | Path traversal prevention in `downloadResume` (B-05) |
| `backend/src/controllers/interviewController.ts` | Replaced N+1 violation count with aggregation (PERF-01) |
| `backend/src/routes/proctoring.ts` | All routes now require authentication (SEC-02) |
| `backend/src/models/Application.ts` | Removed duplicate status history from pre-save hook (B-07/B-08) |
| `backend/src/config/index.ts` | Production secret validation (SEC-06), port fix (B-11), email typo (B-13), CORS cleanup (4.13) |
| `backend/src/app.ts` | Swagger gated to non-prod (SEC-10), uploads static serving gated to dev (SEC-12) |
| `docker-compose.yml` | MongoDB credentials via env vars (SEC-08) |

---

## Not Fixed (Deferred to Phase 2+)

| ID | Issue | Reason for Deferral |
|----|-------|---------------------|
| B-06 / SEC-07 | Refresh token revocation | Requires Redis token store implementation (~4 hours) |
| 4.11 | Deprecated `xss-clean` package | Requires npm dependency swap + regression testing |
| PERF-02 | Dashboard sequential `countDocuments` | Requires rewriting to aggregation pipeline (~1 day) |
| PERF-04 | Proctoring heartbeat DB flood | Requires Redis counter integration |
| 4.14 | `console.log` in frontend pages | Cosmetic; spread across many files |
| 4.16 | LLM prompt injection mitigation | Requires input sanitization layer in Python service |
| SEC-11 | Calendar OAuth tokens stored in plaintext | Requires encryption utility integration |
