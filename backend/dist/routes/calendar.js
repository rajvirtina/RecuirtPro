"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const calendarController_1 = require("../controllers/calendarController");
const auth_1 = require("../middleware/auth");
const types_1 = require("../types");
const router = express_1.default.Router();
/**
 * OAuth routes
 */
router.get('/auth/:provider', auth_1.protect, calendarController_1.initiateOAuth);
router.get('/callback/:provider', calendarController_1.handleOAuthCallback);
/**
 * Integration management routes
 */
router.use(auth_1.protect);
router.get('/integrations', calendarController_1.getIntegrations);
router.delete('/integrations/:id', calendarController_1.deleteIntegration);
/**
 * Calendar event routes
 */
router.post('/event/:interviewId', (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.HR, types_1.UserRole.ADMIN), calendarController_1.createCalendarEvent);
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=calendar.js.map