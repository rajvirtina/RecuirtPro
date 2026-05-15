import { Response } from 'express';
import { AuthRequest } from '../types';
/**
 * GDPR Controller
 * Handles data subject rights: access, portability, erasure, restriction
 */
/**
 * Export all personal data for a user (GDPR Article 15 & 20)
 * GET /api/gdpr/export
 */
export declare const exportUserData: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * Request account deletion (GDPR Article 17)
 * DELETE /api/gdpr/delete-account
 */
export declare const requestAccountDeletion: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * Get consent history (GDPR Article 7)
 * GET /api/gdpr/consent-history
 */
export declare const getConsentHistory: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * Withdraw consent for specific type (GDPR Article 7.3)
 * POST /api/gdpr/withdraw-consent
 */
export declare const withdrawConsent: (req: AuthRequest, res: Response) => Promise<void | Response>;
//# sourceMappingURL=gdprController.d.ts.map