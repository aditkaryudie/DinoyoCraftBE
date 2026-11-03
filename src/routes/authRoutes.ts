// ============================================================
//  src/routes/authRoutes.ts
//  Router Autentikasi & Akun Pengguna
// ============================================================

import { Router } from 'express';
import {
  registerCustomer,
  verifyRegisterOtp,
  resendRegisterOtp,
  registerMitra,
  login,
  loginMitra,
  googleLogin,
  getProfile,
  updateProfile,
  forgotPassword,
  verifyOtp,
  resetPassword,
  reuploadDocs,
  saveFcmToken,
} from '../controllers/authController.js';
import { uploadMitraDocs, uploadProfileImages } from '../middlewares/uploadMiddleware.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { validateZod } from '../middlewares/validatorMiddleware.js';
import {
  registerMitraSchema,
  loginSchema,
  googleLoginSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../validators/schemas.js';

const router = Router();

// Registrasi & Login
router.post('/register-customer', registerCustomer);
router.post('/verify-register-otp', verifyRegisterOtp);
router.post('/resend-register-otp', resendRegisterOtp);
router.post('/register-mitra', uploadMitraDocs, validateZod(registerMitraSchema), registerMitra);
router.post('/login', validateZod(loginSchema), login);
router.post('/login-mitra', validateZod(loginSchema), loginMitra);
router.post('/google-login', validateZod(googleLoginSchema), googleLogin);
router.post('/google-register', validateZod(googleLoginSchema), (req, _res, next) => {
  req.body.is_register = true;
  next();
}, googleLogin);

// Lupa Kata Sandi & OTP
router.post('/forgot-password', validateZod(forgotPasswordSchema), forgotPassword);
router.post('/verify-otp', validateZod(verifyOtpSchema), verifyOtp);
router.post('/reset-password', validateZod(resetPasswordSchema), resetPassword);

// Profil Pengguna & Dokumen
router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, uploadProfileImages, validateZod(updateProfileSchema), updateProfile);
router.post('/reupload-docs', verifyToken, uploadMitraDocs, reuploadDocs);

// FCM Device Token
router.post('/fcm-token', verifyToken, saveFcmToken);

export default router;
