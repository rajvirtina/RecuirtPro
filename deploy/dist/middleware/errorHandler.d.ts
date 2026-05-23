import { Request, Response, NextFunction } from 'express';
/**
 * Error handler middleware
 */
export declare const errorHandler: (err: any, req: Request, res: Response, next: NextFunction) => Response;
/**
 * Not found middleware
 */
export declare const notFound: (req: Request, res: Response, next: NextFunction) => Response;
/**
 * Async handler wrapper
 */
export declare const asyncHandler: (fn: Function) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=errorHandler.d.ts.map