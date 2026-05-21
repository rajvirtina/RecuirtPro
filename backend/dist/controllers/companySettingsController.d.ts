import { Response } from 'express';
import { AuthRequest } from '../types';
/**
 * GET /api/v1/companies/settings
 */
export declare const getCompanySettings: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * PATCH /api/v1/companies/settings
 */
export declare const updateCompanySettings: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * PATCH /api/v1/companies/branding
 */
export declare const updateBranding: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/v1/companies/branding/logo — multipart upload
 */
export declare const uploadLogo: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * GET /api/v1/companies/pipeline-stages
 */
export declare const getPipelineStages: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * PUT /api/v1/companies/pipeline-stages
 */
export declare const updatePipelineStages: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=companySettingsController.d.ts.map