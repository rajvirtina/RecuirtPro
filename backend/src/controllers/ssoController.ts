import { Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { Company } from '../models/Company';
import { User } from '../models/User';
import { encrypt, decrypt } from '../utils/encryption';
import { sendError, sendSuccess } from '../utils/response';
import { AuthRequest, UserRole } from '../types';
import config from '../config';
import logger from '../utils/logger';

// ── In-memory state store (TTL 10 min) ───────────────────────────────────────
// Each pending SSO auth is stored by state token until the callback arrives.
const pendingStates = new Map<string, {
  companyId: string;
  nonce: string;
  expiresAt: number;
}>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingStates.entries()) {
    if (v.expiresAt < now) pendingStates.delete(k);
  }
}, 60_000);

// ── OIDC discovery cache (5 min TTL) ─────────────────────────────────────────
interface OIDCDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri?: string;
}
const discoveryCache = new Map<string, { doc: OIDCDiscovery; cachedAt: number }>();

async function getOIDCDiscovery(discoveryUrl: string): Promise<OIDCDiscovery> {
  const cached = discoveryCache.get(discoveryUrl);
  if (cached && Date.now() - cached.cachedAt < 5 * 60_000) return cached.doc;

  const wellKnown = discoveryUrl.replace(/\/$/, '') + '/.well-known/openid-configuration';
  const res = await axios.get<OIDCDiscovery>(wellKnown, { timeout: 8000 });
  discoveryCache.set(discoveryUrl, { doc: res.data, cachedAt: Date.now() });
  return res.data;
}

// ── FRONTEND_URL helper ───────────────────────────────────────────────────────
const frontendUrl = () => config.frontendUrl || 'http://localhost:3000';
const backendUrl  = () => process.env.BACKEND_URL || `http://localhost:${config.port}`;

/* ─────────────────────────────────────────────────────────────────────────────
 * GET /api/v1/auth/sso/:slug/initiate
 * Redirects the browser to the IdP authorization endpoint.
 * ───────────────────────────────────────────────────────────────────────────*/
export const initiateSSOLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const company = await Company.findOne({ slug, status: 'active' })
      .select('+sso.oidcClientSecret +sso.samlCert')
      .lean();

    if (!company) { res.status(404).json({ success: false, message: 'Company not found' }); return; }
    if (!company.sso?.enabled) { res.status(400).json({ success: false, message: 'SSO is not enabled for this company' }); return; }

    if (company.sso.type === 'oidc') {
      if (!company.sso.oidcDiscoveryUrl || !company.sso.oidcClientId) {
        res.status(400).json({ success: false, message: 'OIDC is not fully configured' });
        return;
      }

      const discovery = await getOIDCDiscovery(company.sso.oidcDiscoveryUrl);
      const state = crypto.randomBytes(24).toString('hex');
      const nonce = crypto.randomBytes(24).toString('hex');

      pendingStates.set(state, {
        companyId: (company._id as any).toString(),
        nonce,
        expiresAt: Date.now() + 10 * 60_000,
      });

      const redirectUri = `${backendUrl()}/api/v1/auth/sso/${slug}/callback`;
      const params = new URLSearchParams({
        response_type: 'code',
        client_id:     company.sso.oidcClientId,
        redirect_uri:  redirectUri,
        scope:         'openid email profile',
        state,
        nonce,
      });

      res.redirect(`${discovery.authorization_endpoint}?${params.toString()}`);
    } else {
      res.status(501).json({ success: false, message: 'SAML SSO initiation not yet implemented via this endpoint' });
    }
  } catch (err: any) {
    logger.error('[SSO] initiateSSOLogin error:', err.message);
    res.redirect(`${frontendUrl()}/login?error=sso_failed`);
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
 * GET /api/v1/auth/sso/:slug/callback
 * Handles the IdP redirect, exchanges the code for tokens, creates/logs in user.
 * ───────────────────────────────────────────────────────────────────────────*/
export const handleSSOCallback = async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  const { code, state, error: idpError } = req.query as Record<string, string>;

  if (idpError) {
    logger.warn(`[SSO] IdP returned error for ${slug}: ${idpError}`);
    res.redirect(`${frontendUrl()}/login?error=sso_denied`);
    return;
  }

  try {
    // Validate state
    const pending = pendingStates.get(state);
    if (!pending || pending.expiresAt < Date.now()) {
      res.redirect(`${frontendUrl()}/login?error=sso_state_expired`);
      return;
    }
    pendingStates.delete(state);

    const company = await Company.findById(pending.companyId)
      .select('+sso.oidcClientSecret')
      .lean();
    if (!company?.sso?.enabled) {
      res.redirect(`${frontendUrl()}/login?error=sso_not_configured`);
      return;
    }

    if (company.sso.type !== 'oidc') {
      res.redirect(`${frontendUrl()}/login?error=sso_type_unsupported`);
      return;
    }

    const discovery = await getOIDCDiscovery(company.sso.oidcDiscoveryUrl!);
    const redirectUri = `${backendUrl()}/api/v1/auth/sso/${slug}/callback`;

    // Exchange authorization code for tokens
    const clientSecret = company.sso.oidcClientSecret
      ? (() => { try { return decrypt(company.sso!.oidcClientSecret!); } catch { return company.sso!.oidcClientSecret!; } })()
      : '';

    const tokenRes = await axios.post(discovery.token_endpoint, new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id:    company.sso.oidcClientId!,
      client_secret: clientSecret,
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10_000,
    });

    const accessToken: string = tokenRes.data.access_token;

    // Fetch user info from userinfo endpoint
    const userInfoRes = await axios.get(discovery.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 8_000,
    });
    const userInfo = userInfoRes.data;

    const email: string | undefined = userInfo.email;
    if (!email) {
      res.redirect(`${frontendUrl()}/login?error=sso_no_email`);
      return;
    }

    // Enforce allowed email domains
    const emailDomain = email.split('@')[1];
    if (company.sso.allowedEmailDomains?.length) {
      if (!company.sso.allowedEmailDomains.includes(emailDomain)) {
        res.redirect(`${frontendUrl()}/login?error=sso_domain_not_allowed`);
        return;
      }
    }

    // Find or create user
    let user = await User.findOne({ email, companyId: company._id, deletedAt: { $exists: false } });
    if (!user) {
      const nameParts = (userInfo.name || email.split('@')[0]).split(' ');
      user = await User.create({
        email,
        firstName:     nameParts[0] || email.split('@')[0],
        lastName:      nameParts.slice(1).join(' ') || '',
        role:          company.sso.defaultRole ?? UserRole.HR,
        companyId:     company._id,
        emailVerified: true,
        status:        'active',
        password:      crypto.randomBytes(32).toString('hex'),
      });
      logger.info(`[SSO] Created user via SSO: ${email} for company ${slug}`);
    }

    if (user.status !== 'active') {
      res.redirect(`${frontendUrl()}/login?error=sso_account_inactive`);
      return;
    }

    // Issue RecuirtPro JWT (same shape as regular login)
    const payload = {
      id:        user._id.toString(),
      email:     user.email,
      role:      user.role,
      companyId: user.companyId?.toString(),
    };
    const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expire } as any);
    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpire } as any);

    // Return token to frontend via redirect with short-lived query param
    // The frontend should exchange this once and store in httpOnly cookie
    const redirectUrl = new URL(`${frontendUrl()}/sso-callback`);
    redirectUrl.searchParams.set('token', token);
    redirectUrl.searchParams.set('refresh', refreshToken);
    res.redirect(redirectUrl.toString());
  } catch (err: any) {
    logger.error('[SSO] handleSSOCallback error:', err.message);
    res.redirect(`${frontendUrl()}/login?error=sso_failed`);
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
 * GET /api/v1/auth/sso/config  (admin/employer only)
 * Returns the company's SSO configuration (secret fields omitted).
 * ───────────────────────────────────────────────────────────────────────────*/
export const getSSOConfig = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const tenantId = req.user?.companyId;
    const company = await Company.findById(tenantId).select('sso').lean();
    if (!company) return sendError(res, 'Company not found', 404);

    const cfg = company.sso ?? { enabled: false, type: 'oidc' };
    // Never expose secrets in the response
    const safe = {
      enabled:             cfg.enabled,
      type:                cfg.type,
      oidcDiscoveryUrl:    cfg.oidcDiscoveryUrl,
      oidcClientId:        cfg.oidcClientId,
      oidcClientSecretSet: !!cfg.oidcClientSecret,
      samlEntryPoint:      cfg.samlEntryPoint,
      samlIssuer:          cfg.samlIssuer,
      samlCertSet:         !!cfg.samlCert,
      allowedEmailDomains: cfg.allowedEmailDomains ?? [],
      defaultRole:         cfg.defaultRole ?? 'hr',
    };
    return sendSuccess(res, safe, 'SSO configuration retrieved');
  } catch (err: any) {
    logger.error('[SSO] getSSOConfig error:', err.message);
    return sendError(res, 'Failed to retrieve SSO configuration', 500);
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
 * POST /api/v1/auth/sso/config  (admin/employer only)
 * Saves the company's SSO configuration. Client secret is encrypted at rest.
 * ───────────────────────────────────────────────────────────────────────────*/
export const saveSSOConfig = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const tenantId = req.user?.companyId;
    const {
      enabled, type,
      oidcDiscoveryUrl, oidcClientId, oidcClientSecret,
      samlEntryPoint, samlIssuer, samlCert,
      allowedEmailDomains, defaultRole,
    } = req.body;

    const update: Record<string, any> = {
      'sso.enabled': !!enabled,
      'sso.type':    type ?? 'oidc',
    };
    if (oidcDiscoveryUrl !== undefined) update['sso.oidcDiscoveryUrl'] = oidcDiscoveryUrl;
    if (oidcClientId     !== undefined) update['sso.oidcClientId']     = oidcClientId;
    if (oidcClientSecret !== undefined) update['sso.oidcClientSecret'] = encrypt(oidcClientSecret);
    if (samlEntryPoint   !== undefined) update['sso.samlEntryPoint']   = samlEntryPoint;
    if (samlIssuer       !== undefined) update['sso.samlIssuer']       = samlIssuer;
    if (samlCert         !== undefined) update['sso.samlCert']         = samlCert;
    if (allowedEmailDomains !== undefined) update['sso.allowedEmailDomains'] = allowedEmailDomains;
    if (defaultRole      !== undefined) update['sso.defaultRole']      = defaultRole;

    await Company.findByIdAndUpdate(tenantId, { $set: update });
    return sendSuccess(res, null, 'SSO configuration saved');
  } catch (err: any) {
    logger.error('[SSO] saveSSOConfig error:', err.message);
    return sendError(res, 'Failed to save SSO configuration', 500);
  }
};
