import { Router } from 'express';
import { authorize, protect } from '../middleware/auth';
import { UserRole } from '../types';
import {
  initiateSSOLogin,
  handleSSOCallback,
  getSSOConfig,
  saveSSOConfig,
} from '../controllers/ssoController';

const router = Router();

// Public: initiate SSO for a company (redirects to IdP)
router.get('/:slug/initiate', initiateSSOLogin);

// Public: IdP callback after authentication
router.get('/:slug/callback', handleSSOCallback);

// Protected: admin/employer reads SSO config
router.get('/config', protect, authorize(UserRole.ADMIN, UserRole.EMPLOYER), getSSOConfig);

// Protected: admin/employer saves SSO config
router.post('/config', protect, authorize(UserRole.ADMIN, UserRole.EMPLOYER), saveSSOConfig);

export default router;
