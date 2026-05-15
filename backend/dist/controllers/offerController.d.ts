import { Response } from 'express';
import { AuthRequest } from '../types';
/**
 * @desc    Create offer for an application
 * @route   POST /api/v1/offers
 * @access  Private (HR/Admin)
 */
export declare const createOffer: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Get offers for company
 * @route   GET /api/v1/offers
 * @access  Private (HR/Admin)
 */
export declare const getOffers: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Get offer by ID
 * @route   GET /api/v1/offers/:id
 * @access  Private (HR/Admin/Candidate)
 */
export declare const getOfferById: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Update offer status with transition validation
 * @route   PUT /api/v1/offers/:id/status
 * @access  Private (HR/Admin/Candidate for accept/reject)
 */
export declare const updateOfferStatus: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Update offer details (salary negotiation etc.)
 * @route   PUT /api/v1/offers/:id
 * @access  Private (HR/Admin)
 */
export declare const updateOffer: (req: AuthRequest, res: Response) => Promise<void | Response>;
/**
 * @desc    Generate offer letter HTML
 * @route   POST /api/v1/offers/:id/generate-letter
 * @access  Private (HR/Admin)
 */
export declare const generateOfferLetter: (req: AuthRequest, res: Response) => Promise<void | Response>;
//# sourceMappingURL=offerController.d.ts.map