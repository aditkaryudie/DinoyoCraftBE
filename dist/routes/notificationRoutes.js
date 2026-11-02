"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notificationController_js_1 = require("../controllers/notificationController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const router = (0, express_1.Router)();
router.use(authMiddleware_js_1.verifyToken);
router.get('/', notificationController_js_1.getNotifications);
router.patch('/:id/read', notificationController_js_1.markNotificationRead);
router.patch('/read-all', notificationController_js_1.markAllNotificationsRead);
exports.default = router;
//# sourceMappingURL=notificationRoutes.js.map