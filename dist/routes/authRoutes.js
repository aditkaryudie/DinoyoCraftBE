"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const uploadMiddleware_1 = require("../middlewares/uploadMiddleware");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
router.post('/register-mitra', uploadMiddleware_1.uploadMitraDocs, authController_1.registerMitra);
router.post('/login', authController_1.loginMitra);
router.post('/login-mitra', authController_1.loginMitra);
router.post('/google-login', authController_1.googleLogin);
router.post('/forgot-password', authController_1.forgotPassword);
router.post('/verify-otp', authController_1.verifyOtp);
router.post('/reset-password', authController_1.resetPassword);
router.get('/profile', authMiddleware_1.verifyToken, authController_1.getProfile);
router.put('/profile', authMiddleware_1.verifyToken, uploadMiddleware_1.uploadProfileImages, authController_1.updateProfile);
router.post('/reupload-docs', authMiddleware_1.verifyToken, uploadMiddleware_1.uploadMitraDocs, authController_1.reuploadDocs);
exports.default = router;
//# sourceMappingURL=authRoutes.js.map