import express from 'express';
import { protect } from '../middleware/auth';
import {
  exportUserData,
  requestAccountDeletion,
  getConsentHistory,
  withdrawConsent,
} from '../controllers/gdprController';

const router = express.Router();

/**
 * GDPR Routes
 * All routes require authentication
 */

// Export personal data (GDPR Article 15 & 20)
router.get('/export', protect, exportUserData);

// Get consent history (GDPR Article 7)
router.get('/consent-history', protect, getConsentHistory);

// Withdraw consent (GDPR Article 7.3)
router.post('/withdraw-consent', protect, withdrawConsent);

// Request account deletion (GDPR Article 17)
router.delete('/delete-account', protect, requestAccountDeletion);

export default router;
