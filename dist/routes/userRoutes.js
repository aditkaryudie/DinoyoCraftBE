"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_js_1 = require("../controllers/authController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const router = (0, express_1.Router)();
router.post('/fcm-token', authMiddleware_js_1.verifyToken, authController_js_1.saveFcmToken);
exports.default = router;
//# sourceMappingURL=userRoutes.js.map