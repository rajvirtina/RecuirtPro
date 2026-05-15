"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const questionController_1 = require("../controllers/questionController");
const auth_1 = require("../middleware/auth");
const types_1 = require("../types");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_1.protect);
/**
 * Question CRUD routes
 */
router.post('/', (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.HR, types_1.UserRole.ADMIN), questionController_1.createQuestion);
router.get('/', questionController_1.getQuestions);
router.get('/stats', questionController_1.getQuestionStats);
router.get('/:id', questionController_1.getQuestionById);
router.put('/:id', (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.HR, types_1.UserRole.ADMIN), questionController_1.updateQuestion);
router.delete('/:id', (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.HR, types_1.UserRole.ADMIN), questionController_1.deleteQuestion);
/**
 * Auto-generate questions
 */
router.post('/auto-generate', (0, auth_1.authorize)(types_1.UserRole.EMPLOYER, types_1.UserRole.HR, types_1.UserRole.ADMIN), questionController_1.autoGenerateQuestions);
exports.default = router;
//# sourceMappingURL=questions.js.map