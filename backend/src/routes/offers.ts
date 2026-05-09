import express from 'express';
import {
  createOffer,
  getOffers,
  getOfferById,
  updateOfferStatus,
  updateOffer,
  generateOfferLetter,
} from '../controllers/offerController';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = express.Router();

router.use(protect);

// HR/Admin/Employer routes
router.post('/', authorize(UserRole.ADMIN, UserRole.HR, UserRole.EMPLOYER), createOffer);
router.get('/', authorize(UserRole.ADMIN, UserRole.HR, UserRole.EMPLOYER), getOffers);
router.get('/:id', getOfferById); // Candidates can view their own offer
router.put('/:id', authorize(UserRole.ADMIN, UserRole.HR, UserRole.EMPLOYER), updateOffer);
router.put('/:id/status', updateOfferStatus); // Candidates can accept/reject
router.post('/:id/generate-letter', authorize(UserRole.ADMIN, UserRole.HR, UserRole.EMPLOYER), generateOfferLetter);

export default router;
