import { Router } from 'express';
import {
  registerMitra,
  loginMitra,
  googleLogin,
  getProfile,
  updateProfile,
  forgotPassword,
  verifyOtp,
  resetPassword,
  reuploadDocs
} from '../controllers/authController';
import { uploadMitraDocs, uploadProfileImages } from '../middlewares/uploadMiddleware';
import { verifyToken } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register-mitra', uploadMitraDocs, registerMitra);
router.post('/login', loginMitra);
router.post('/login-mitra', loginMitra);
router.post('/google-login', googleLogin);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, uploadProfileImages, updateProfile);
router.post('/reupload-docs', verifyToken, uploadMitraDocs, reuploadDocs);

export default router;
