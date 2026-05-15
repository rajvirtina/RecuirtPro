"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const notificationController_1 = require("../controllers/notificationController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.protect);
router.get('/', notificationController_1.getNotifications);
router.get('/unread-count', notificationController_1.getUnreadCount);
router.put('/read-all', notificationController_1.markAllAsRead);
router.put('/:id/read', notificationController_1.markAsRead);
router.delete('/:id', notificationController_1.deleteNotification);
exports.default = router;
//# sourceMappingURL=notifications.js.map