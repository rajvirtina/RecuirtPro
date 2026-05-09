import { Request, Response, NextFunction } from 'express';
import xss from 'xss';

/**
 * XSS sanitization middleware (replaces deprecated xss-clean v0.1.4)
 * Recursively sanitizes all string values in req.body, req.query, and req.params.
 */
function sanitizeValue(value: any): any {
  if (typeof value === 'string') {
    return xss(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    const sanitized: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      sanitized[key] = sanitizeValue(value[key]);
    }
    return sanitized;
  }
  return value;
}

export const xssSanitize = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
};
