import { Response } from 'express';
import { AuthRequest } from '../types';
export declare const getIntegrations: (req: AuthRequest, res: Response) => Promise<void | Response>;
export declare const initiateOAuth: (req: AuthRequest, res: Response) => Promise<void | Response>;
export declare const oauthCallback: (req: AuthRequest, res: Response) => Promise<void | Response>;
export declare const disconnectIntegration: (req: AuthRequest, res: Response) => Promise<void | Response>;
export declare const searchCandidates: (req: AuthRequest, res: Response) => Promise<void | Response>;
export declare const searchCandidatesForJob: (req: AuthRequest, res: Response) => Promise<void | Response>;
export declare const saveSourcedCandidate: (req: AuthRequest, res: Response) => Promise<void | Response>;
export declare const getSourcedCandidates: (req: AuthRequest, res: Response) => Promise<void | Response>;
export declare const updateCandidateStatus: (req: AuthRequest, res: Response) => Promise<void | Response>;
export declare const getSourcingStats: (req: AuthRequest, res: Response) => Promise<void | Response>;
export declare const exportCandidates: (req: AuthRequest, res: Response) => Promise<void | Response>;
//# sourceMappingURL=sourcingController.d.ts.map