"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const proctoringController_1 = require("../controllers/proctoringController");
const auth_1 = require("../middleware/auth");
const types_1 = require("../types");
const router = express_1.default.Router();
/**
 * All proctoring routes require authentication (SEC-02/B-03 fix)
 * Previously these were public, allowing arbitrary event injection.
 */
router.use(auth_1.protect);
// Candidate-accessible routes (any authenticated user with a valid interview)
router.post('/verify/:interviewId', proctoringController_1.verifySystemReadiness);
router.post('/event', proctoringController_1.logProctoringEvent);
router.get('/system-check/:interviewId', proctoringController_1.getSystemCheckStatus);
// Desktop app routes
router.post('/desktop-event', proctoringController_1.reportDesktopEvent);
router.post('/heartbeat', proctoringController_1.sendHeartbeat);
router.get('/interview-status/:interviewId', proctoringController_1.getInterviewStatus);
// HR/Admin routes
router.get('/events/recent', (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.HR, types_1.UserRole.ADMIN), proctoringController_1.getRecentProctoringEvents);
router.get('/events/:interviewId', (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.HR, types_1.UserRole.ADMIN), proctoringController_1.getProctoringEvents);
router.put('/event/:id/review', (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.HR, types_1.UserRole.ADMIN), proctoringController_1.reviewProctoringEvent);
exports.default = router;
//# sourceMappingURL=proctoring.js.map