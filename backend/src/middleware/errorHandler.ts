import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import logger from '../utils/logger';

function captureSentry(err: any, req: Request) {
  try {
    // Lazy-import so Sentry is optional; no crash if package is absent
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/node');
    if (Sentry?.captureException && err.statusCode !== 404) {
      Sentry.withScope((scope: any) => {
        scope.setTag('path', req.path);
        scope.setTag('method', req.method);
        Sentry.captureException(err);
      });
    }
  } catch { /* Sentry not installed — silent */ }
}

/**
 * Error handler middleware
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): Response => {
  let error = { ...err };
  error.message = err.message;

  // Report 5xx errors to Sentry (4xx are expected, not bugs)
  if (!err.statusCode || err.statusCode >= 500) {
    captureSentry(err, req);
  }

  // Log error
  logger.error(`Error: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    return sendError(res, message, 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    return sendError(res, message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val: any) => val.message);
    return sendError(res, 'Validation error', 400, messages);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token expired', 401);
  }

  return sendError(
    res,
    error.message || 'Server Error',
    error.statusCode || 500
  );
};

/**
 * Not found middleware
 */
export const notFound = (req: Request, res: Response, next: NextFunction): Response => {
  return sendError(res, `Route ${req.originalUrl} not found`, 404);
};

/**
 * Async handler wrapper
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
