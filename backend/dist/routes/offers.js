"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const offerController_1 = require("../controllers/offerController");
const auth_1 = require("../middleware/auth");
const types_1 = require("../types");
const router = express_1.default.Router();
router.use(auth_1.protect);
// HR/Admin/Employer routes
router.post('/', (0, auth_1.authorize)(types_1.UserRole.ADMIN, types_1.UserRole.HR, types_1.UserRole.EMPLOYER), offerController_1.createOffer);
router.get('/', (0, auth_1.authorize)(types_1.UserRole.ADMIN, types_1.UserRole.HR, types_1.UserRole.EMPLOYER), offerController_1.getOffers);
router.get('/:id', offerController_1.getOfferById); // Candidates can view their own offer
router.put('/:id', (0, auth_1.authorize)(types_1.UserRole.ADMIN, types_1.UserRole.HR, types_1.UserRole.EMPLOYER), offerController_1.updateOffer);
router.put('/:id/status', offerController_1.updateOfferStatus); // Candidates can accept/reject
router.post('/:id/generate-letter', (0, auth_1.authorize)(types_1.UserRole.ADMIN, types_1.UserRole.HR, types_1.UserRole.EMPLOYER), offerController_1.generateOfferLetter);
exports.default = router;
//# sourceMappingURL=offers.js.map