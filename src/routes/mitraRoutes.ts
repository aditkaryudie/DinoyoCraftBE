import express from 'express';
import {
  getDashboardMitra,
  getFinanceReport,
  withdrawWallet,
  getOrders,
  updateOrderShipping,
  replyOrderReview,
  updateProduct,
  getPublicMitraStores,
  getPublicMitraDetail
} from '../controllers/mitraController.js';
import { getStoreProfile } from '../controllers/storeController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// Route Publik Profil Toko Mitra untuk Konsumsi Mobile & Tamu
router.get('/public', getPublicMitraStores);
router.get('/:id/public', getPublicMitraDetail);

// Route terlindungi oleh middleware verifyToken
router.get('/dashboard', verifyToken, getDashboardMitra);

// Route untuk halaman Toko Saya
router.get('/store-profile', verifyToken, getStoreProfile);

// Endpoint Manajemen Mitra
router.get('/finance', verifyToken, getFinanceReport);
router.post('/wallet/withdraw', verifyToken, withdrawWallet);
router.get('/orders', verifyToken, getOrders);
router.patch('/orders/:id/shipping', verifyToken, updateOrderShipping);
router.post('/orders/:id/reply', verifyToken, replyOrderReview);
router.put('/products/:id', verifyToken, upload.single('image'), updateProduct);

export default router;
