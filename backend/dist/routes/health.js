"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const axios_1 = __importDefault(require("axios"));
const queueProcessors_1 = require("../services/queueProcessors");
const config_1 = require("../config");
const router = (0, express_1.Router)();
router.get('/health', async (_req, res) => {
    const checks = {};
    // ── MongoDB ───────────────────────────────────────────────────────────────
    const mongoStart = Date.now();
    try {
        const state = mongoose_1.default.connection.readyState;
        if (state === 1) {
            // Ping the admin database to verify a round-trip, not just socket state
            await mongoose_1.default.connection.db.admin().ping();
            checks.mongodb = { status: 'ok', latencyMs: Date.now() - mongoStart };
        }
        else {
            checks.mongodb = {
                status: 'degraded',
                latencyMs: Date.now() - mongoStart,
                detail: `readyState=${state} (0=disconnected,2=connecting,3=disconnecting)`,
            };
        }
    }
    catch (err) {
        checks.mongodb = {
            status: 'degraded',
            latencyMs: Date.now() - mongoStart,
            detail: err.message,
        };
    }
    // ── Redis / Bull queues ───────────────────────────────────────────────────
    checks.redis = (0, queueProcessors_1.isRedisAvailable)()
        ? { status: 'ok' }
        : { status: 'degraded', detail: 'Queue unavailable — emails sent synchronously' };
    // ── LLM service ───────────────────────────────────────────────────────────
    const llmUrl = config_1.config.llm?.baseUrl || process.env.LLM_BASE_URL;
    if (llmUrl) {
        const llmStart = Date.now();
        try {
            await axios_1.default.get(`${llmUrl}/health`, { timeout: 3000 });
            checks.llm = { status: 'ok', latencyMs: Date.now() - llmStart };
        }
        catch (err) {
            checks.llm = {
                status: 'degraded',
                latencyMs: Date.now() - llmStart,
                detail: err.code === 'ECONNREFUSED' ? 'LLM service not reachable' : err.message,
            };
        }
    }
    else {
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
exports.default = router;
//# sourceMappingURL=health.js.map