import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { sendError } from '../utils/response';

/**
 * Validate request using express-validator
 */
export const validate = (req: Request, res: Response, next: NextFunction): void | Response => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => ({
      field: err.type === 'field' ? (err as any).path : 'unknown',
      message: err.msg,
    }));
    
    return sendError(res, 'Validation failed', 400, errorMessages);
  }
  
  next();
};
