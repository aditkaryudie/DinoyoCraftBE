"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_js_1 = require("../controllers/authController.js");
const uploadMiddleware_js_1 = require("../middlewares/uploadMiddleware.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const router = (0, express_1.Router)();
// Registrasi & Login
router.get('/check-username', authController_js_1.checkUsername);
router.post('/register-customer', authController_js_1.registerCustomer);
router.post('/verify-register-otp', authController_js_1.verifyRegisterOtp);
router.post('/resend-register-otp', authController_js_1.resendRegisterOtp);
router.post('/register-mitra', uploadMiddleware_js_1.uploadMitraDocs, authController_js_1.registerMitra);
router.post('/login', authController_js_1.loginMitra);
router.post('/login-mitra', authController_js_1.loginMitra);
router.post('/google-login', authController_js_1.googleLogin);
// Lupa Password & OTP
router.post('/forgot-password', authController_js_1.forgotPassword);
router.post('/verify-otp', authController_js_1.verifyOtp);
router.post('/reset-password', authController_js_1.resetPassword);
// Profil
router.get('/profile', authMiddleware_js_1.verifyToken, authController_js_1.getProfile);
router.put('/profile', authMiddleware_js_1.verifyToken, uploadMiddleware_js_1.uploadProfileImages, authController_js_1.updateProfile);
router.post('/reupload-docs', authMiddleware_js_1.verifyToken, uploadMiddleware_js_1.uploadMitraDocs, authController_js_1.reuploadDocs);
// FCM Device Token
router.post('/fcm-token', authMiddleware_js_1.verifyToken, authController_js_1.saveFcmToken);
exports.default = router;
//# sourceMappingURL=authRoutes.js.map