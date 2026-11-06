import { Router } from 'express';
import {
  registerCustomer,
  registerMitra,
  loginMitra,
  googleLogin,
  getProfile,
  updateProfile,
  forgotPassword,
  verifyOtp,
  resetPassword,
  reuploadDocs,
  saveFcmToken,
  checkUsername,
  verifyRegisterOtp,
  resendRegisterOtp
} from '../controllers/authController.js';
import { uploadMitraDocs, uploadProfileImages } from '../middlewares/uploadMiddleware.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

// Registrasi & Login
router.get('/check-username', checkUsername);
router.post('/register-customer', registerCustomer);
router.post('/verify-register-otp', verifyRegisterOtp);
router.post('/resend-register-otp', resendRegisterOtp);
router.post('/register-mitra', uploadMitraDocs, registerMitra);
router.post('/login', loginMitra);
router.post('/login-mitra', loginMitra);
router.post('/google-login', googleLogin);

// Lupa Password & OTP
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);

// Profil
router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, uploadProfileImages, updateProfile);
router.post('/reupload-docs', verifyToken, uploadMitraDocs, reuploadDocs);

// FCM Device Token
router.post('/fcm-token', verifyToken, saveFcmToken);

export default router;
