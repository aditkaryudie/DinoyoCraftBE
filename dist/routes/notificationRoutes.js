"use strict";
// ============================================================
//  src/routes/notificationRoutes.ts
//  Router Pusat Notifikasi
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notificationController_js_1 = require("../controllers/notificationController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const router = (0, express_1.Router)();
// Semua rute notifikasi wajib login
router.use(authMiddleware_js_1.verifyToken);
router.get('/', notificationController_js_1.getUserNotifications);
router.patch('/read-all', notificationController_js_1.markAllAsRead);
router.patch('/:id/read', notificationController_js_1.markAsRead);
router.delete('/:id', notificationController_js_1.deleteNotification);
exports.default = router;
//# sourceMappingURL=notificationRoutes.js.map