import { Request, Response, NextFunction } from 'express';
import { Company } from '../models';
import logger from '../utils/logger';

/** Well-known hostnames that should never be treated as custom domains. */
const PLATFORM_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  'hiring.ambiquest.com',
  'api.ambiquest.com',
  'recruitpro.com',
  'www.recruitpro.com',
  'app.recruitpro.com',
  'api.recruitpro.com',
]);

/**
 * Custom domain middleware.
 *
 * Reads the Host header, strips the port, and if the hostname is not a
 * well-known platform host it queries the Company collection for a matching
 * branding.customDomain.  When found, it attaches the company's _id string
 * to `req.customDomainCompanyId` so that downstream auth middleware and
 * controllers can use it for tenant scoping.
 *
 * Mount this *before* the rate limiter and route handlers in app.ts.
 */
export const customDomainMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawHost = req.headers.host || '';
    // Strip port (e.g. "acme.com:3000" → "acme.com")
    const hostname = rawHost.split(':')[0].toLowerCase().trim();

    if (!hostname || PLATFORM_HOSTS.has(hostname)) {
      return next();
    }

    // Cache miss? Resolve from DB.  Use lean() for speed.
    const company = await Company.findOne({
      'branding.customDomain': hostname,
      status: 'active',
      deletedAt: null,
    })
      .select('_id')
      .lean();

    if (company) {
      (req as any).customDomainCompanyId = String(company._id);
      logger.debug(`Custom domain resolved: ${hostname} → company ${company._id}`);
    }
  } catch (err: any) {
    // Non-fatal — do not block the request
    logger.warn(`customDomainMiddleware error (non-fatal): ${err.message}`);
  }

  next();
};
