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
exports.default = router;
//# sourceMappingURL=calendar.js.map