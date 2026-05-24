/**
 * GET /api/health
 *
 * Unprotected health check for load-balancer probes, uptime monitors, and
 * on-call runbooks. Returns HTTP 200 when all critical services are up,
 * HTTP 503 when any of MongoDB / Redis / LLM is degraded, with a per-service
 * status breakdown so responders know which component to investigate.
 *
 * Redis and LLM are treated as "non-critical" — the application can run without
 * them. MongoDB failure is the only condition that changes the top-level status
 * to 'degraded' (503), but all sub-statuses are reported regardless.
 */
import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import axios from 'axios';
import { isRedisAvailable } from '../services/queueProcessors';
import { config } from '../config';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: 'ok' | 'degraded'; latencyMs?: number; detail?: string }> = {};

  // ── MongoDB ───────────────────────────────────────────────────────────────
  const mongoStart = Date.now();
  try {
    const state = mongoose.connection.readyState;
    if (state === 1) {
      // Ping the admin database to verify a round-trip, not just socket state
      await (mongoose.connection.db as any).admin().ping();
      checks.mongodb = { status: 'ok', latencyMs: Date.now() - mongoStart };
    } else {
      checks.mongodb = {
        status: 'degraded',
        latencyMs: Date.now() - mongoStart,
        detail: `readyState=${state} (0=disconnected,2=connecting,3=disconnecting)`,
      };
    }
  } catch (err: any) {
    checks.mongodb = {
      status: 'degraded',
      latencyMs: Date.now() - mongoStart,
      detail: err.message,
    };
  }

  // ── Redis / Bull queues ───────────────────────────────────────────────────
  checks.redis = isRedisAvailable()
    ? { status: 'ok' }
    : { status: 'degraded', detail: 'Queue unavailable — emails sent synchronously' };

  // ── LLM service ───────────────────────────────────────────────────────────
  const llmUrl = (config as any).llm?.baseUrl || process.env.LLM_BASE_URL;
  if (llmUrl) {
    const llmStart = Date.now();
    try {
      await axios.get(`${llmUrl}/health`, { timeout: 3000 });
      checks.llm = { status: 'ok', latencyMs: Date.now() - llmStart };
    } catch (err: any) {
      checks.llm = {
        status: 'degraded',
        latencyMs: Date.now() - llmStart,
        detail: err.code === 'ECONNREFUSED' ? 'LLM service not reachable' : err.message,
      };
    }
  } else {
    checks.llm = { status: 'ok', detail: 'No LLM_BASE_URL configured — skipped' };
  }

  // ── Overall status ────────────────────────────────────────────────────────
  // Only MongoDB being degraded makes the whole system degraded
  const overallOk = checks.mongodb.status === 'ok';

  return res.status(overallOk ? 200 : 503).json({
    status: overallOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    checks,
  });
});

export default router;
