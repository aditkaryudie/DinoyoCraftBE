import { Router } from 'express';
import { registerMitra, loginMitra, googleLogin } from '../controllers/authController';
import { uploadMitraDocs } from '../middlewares/uploadMiddleware';

const router = Router();

// Endpoint khusus Register Mitra (Harus lewat uploadMitraDocs dulu)
router.post('/register-mitra', uploadMitraDocs, registerMitra);

router.post('/login-mitra', loginMitra);

// Endpoint Google Login
router.post('/google-login', googleLogin);

export default router;
