import express from 'express';
import { getDashboardMitra, getFinanceReport, getOrders, updateProduct } from '../controllers/mitraController.js';
import { getStoreProfile } from '../controllers/storeController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Route terlindungi oleh middleware verifyToken
router.get('/dashboard', verifyToken, getDashboardMitra);

// Route untuk halaman Toko Saya
router.get('/store-profile', verifyToken, getStoreProfile);

// 3 Endpoint Baru Mitra
router.get('/finance', verifyToken, getFinanceReport);
router.get('/orders', verifyToken, getOrders);
router.put('/products/:id', verifyToken, updateProduct);

export default router;