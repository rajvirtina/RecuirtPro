"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const gdprController_1 = require("../controllers/gdprController");
const router = express_1.default.Router();
/**
 * GDPR Routes
 * All routes require authentication
 */
// Export personal data (GDPR Article 15 & 20)
router.get('/export', auth_1.protect, gdprController_1.exportUserData);
// Get consent history (GDPR Article 7)
router.get('/consent-history', auth_1.protect, gdprController_1.getConsentHistory);
// Withdraw consent (GDPR Article 7.3)
router.post('/withdraw-consent', auth_1.protect, gdprController_1.withdrawConsent);
// Request account deletion (GDPR Article 17)
router.delete('/delete-account', auth_1.protect, gdprController_1.requestAccountDeletion);
exports.default = router;
//# sourceMappingURL=gdprRoutes.js.map