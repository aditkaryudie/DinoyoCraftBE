import express from 'express';
import { getDashboardMitra } from '../controllers/mitraController.js';
import { getStoreProfile } from '../controllers/storeController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Route terlindungi oleh middleware verifyToken
router.get('/dashboard', verifyToken, getDashboardMitra);

// Route untuk halaman Toko Saya
router.get('/store-profile', verifyToken, getStoreProfile);

export default router;