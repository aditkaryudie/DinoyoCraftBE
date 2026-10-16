import { Router } from 'express';
import { registerMitra, loginMitra, googleLogin, getProfile, updateProfile } from '../controllers/authController';
// Gabungkan uploadProfileImages ke dalam import uploadMiddleware di bawah ini:
import { uploadMitraDocs, uploadProfileImages } from '../middlewares/uploadMiddleware';
import { verifyToken } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register-mitra', uploadMitraDocs, registerMitra);
router.post('/login-mitra', loginMitra);
router.post('/google-login', googleLogin);
router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, uploadProfileImages, updateProfile);

export default router;
