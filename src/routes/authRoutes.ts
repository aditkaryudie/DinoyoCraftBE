import { Router } from 'express';
import {
  registerMitra,
  loginMitra,
  googleLogin,
  getProfile,
  updateProfile,
  forgotPassword,
  verifyOtp,
  resetPassword
} from '../controllers/authController';
// Gabungkan uploadProfileImages ke dalam import uploadMiddleware di bawah ini:
import { uploadMitraDocs, uploadProfileImages } from '../middlewares/uploadMiddleware';
import { verifyToken } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register-mitra', uploadMitraDocs, registerMitra);
router.post('/login-mitra', loginMitra);
router.post('/google-login', googleLogin);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, uploadProfileImages, updateProfile);

export default router;
