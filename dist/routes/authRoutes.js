"use strict";
// ============================================================
//  src/routes/authRoutes.ts
//  Router Autentikasi & Akun Pengguna
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_js_1 = require("../controllers/authController.js");
const uploadMiddleware_js_1 = require("../middlewares/uploadMiddleware.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const validatorMiddleware_js_1 = require("../middlewares/validatorMiddleware.js");
const schemas_js_1 = require("../validators/schemas.js");
const router = (0, express_1.Router)();
// Registrasi & Login
router.post('/register-mitra', uploadMiddleware_js_1.uploadMitraDocs, (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.registerMitraSchema), authController_js_1.registerMitra);
router.post('/login', (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.loginSchema), authController_js_1.loginMitra);
router.post('/login-mitra', (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.loginSchema), authController_js_1.loginMitra);
router.post('/google-login', (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.googleLoginSchema), authController_js_1.googleLogin);
// Lupa Kata Sandi & OTP
router.post('/forgot-password', (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.forgotPasswordSchema), authController_js_1.forgotPassword);
router.post('/verify-otp', (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.verifyOtpSchema), authController_js_1.verifyOtp);
router.post('/reset-password', (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.resetPasswordSchema), authController_js_1.resetPassword);
// Profil Pengguna & Dokumen
router.get('/profile', authMiddleware_js_1.verifyToken, authController_js_1.getProfile);
router.put('/profile', authMiddleware_js_1.verifyToken, uploadMiddleware_js_1.uploadProfileImages, (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.updateProfileSchema), authController_js_1.updateProfile);
router.post('/reupload-docs', authMiddleware_js_1.verifyToken, uploadMiddleware_js_1.uploadMitraDocs, authController_js_1.reuploadDocs);
exports.default = router;
//# sourceMappingURL=authRoutes.js.map