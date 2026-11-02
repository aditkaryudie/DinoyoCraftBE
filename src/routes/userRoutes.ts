import { Router } from 'express';
import { saveFcmToken } from '../controllers/authController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/fcm-token', verifyToken, saveFcmToken);

export default router;

