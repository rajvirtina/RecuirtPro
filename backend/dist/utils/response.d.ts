import { Response } from 'express';
/**
 * Clamp pagination params to safe bounds (B-14)
 */
export declare const clampPagination: (page: any, limit: any) => {
    pageNum: number;
    limitNum: number;
};
/**
 * Send success response
 */
export declare const sendSuccess: <T>(res: Response, data?: T, message?: string, statusCode?: number) => Response;
/**
 * Send error response
 */
export declare const sendError: (res: Response, message: string, statusCode?: number, errors?: any[]) => Response;
/**
 * Send paginated response
 */
export declare const sendPaginatedResponse: <T>(res: Response, data: T[], page: number, limit: number, total: number, message?: string) => Response;
//# sourceMappingURL=response.d.ts.map