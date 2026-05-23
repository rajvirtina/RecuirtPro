"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const express_validator_1 = require("express-validator");
const types_1 = require("../types");
const invitationController_1 = require("../controllers/invitationController");
const router = express_1.default.Router();
// Public routes
router.get('/verify/:token', invitationController_1.verifyInvitationToken);
// Protected routes
router.use(auth_1.protect);
// HR/Employer/Admin only routes
router.post('/send', (0, auth_1.authorize)(types_1.UserRole.HR, types_1.UserRole.EMPLOYER, types_1.UserRole.ADMIN), [(0, express_validator_1.body)('email').isEmail().withMessage('Valid email is required')], validator_1.validate, invitationController_1.sendCandidateInvitation);
router.get('/', (0, auth_1.authorize)(types_1.UserRole.HR, types_1.UserRole.EMPLOYER, types_1.UserRole.ADMIN), invitationController_1.getInvitations);
router.post('/:id/resend', (0, auth_1.authorize)(types_1.UserRole.HR, types_1.UserRole.EMPLOYER, types_1.UserRole.ADMIN), invitationController_1.resendInvitation);
exports.default = router;
//# sourceMappingURL=invitations.js.map