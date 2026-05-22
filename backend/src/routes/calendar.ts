import express from 'express';
import {
  initiateOAuth,
  handleOAuthCallback,
  getIntegrations,
  deleteIntegration,
  createCalendarEvent,
} from '../controllers/calendarController';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = express.Router();

/**
 * OAuth routes
 */
router.get('/auth/:provider', protect, initiateOAuth);
router.get('/callback/:provider', handleOAuthCallback);

/**
 * Integration management routes
 */
router.use(protect);

router.get('/integrations', getIntegrations);
router.delete('/integrations/:id', deleteIntegration);

/**
 * Calendar event routes
 */
router.post(
  '/event/:interviewId',
  authorize(UserRole.EMPLOYER, UserRole.HR, UserRole.ADMIN),
  createCalendarEvent
);

/**
 * Check panel availability (returns free slots for given emails on a date)
 */
router.post('/check-availability', async (req, res) => {
  try {
    const { emails, date } = req.body;
    if (!emails || !date) {
      res.status(400).json({ success: false, message: 'emails and date are required' });
      return;
    }
    // Return default business-hours slots. In production, this would query
    // connected calendar integrations for free/busy data.
    const slots = [
      { startTime: '09:00', endTime: '10:00', available: true },
      { startTime: '10:00', endTime: '11:00', available: true },
      { startTime: '11:00', endTime: '12:00', available: true },
      { startTime: '14:00', endTime: '15:00', available: true },
      { startTime: '15:00', endTime: '16:00', available: true },
      { startTime: '16:00', endTime: '17:00', available: true },
      { startTime: '17:00', endTime: '18:00', available: true },
    ];
    res.json({ success: true, slots });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
