// ============================================================
//  src/routes/mitraRoutes.ts
//  Router Dashboard & Pengelolaan Toko Mitra
// ============================================================

import express from 'express';
import {
  getDashboardMitra,
  getFinanceReport,
  getOrders,
  updateProduct,
  getPublicMitraStores,
  getPublicMitraDetail,
  getMitraWallet,
  requestMitraWithdrawal
} from '../controllers/mitraController.js';
import { getStoreProfile } from '../controllers/storeController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { validateZod } from '../middlewares/validatorMiddleware.js';
import { updateProductSchema } from '../validators/schemas.js';

const router = express.Router();

// Route Publik Profil Toko Mitra untuk Konsumsi Mobile & Tamu
router.get('/public', getPublicMitraStores);
router.get('/:id/public', getPublicMitraDetail);

// Route terlindungi oleh middleware verifyToken
router.get('/dashboard', verifyToken, getDashboardMitra);
router.get('/store-profile', verifyToken, getStoreProfile);
router.get('/finance', verifyToken, getFinanceReport);

// Wallet — saldo & penarikan dana mitra
router.get('/wallet', verifyToken, getMitraWallet);
router.post('/wallet/withdraw', verifyToken, requestMitraWithdrawal);
router.get('/orders', verifyToken, getOrders);
router.put('/products/:id', verifyToken, validateZod(updateProductSchema), updateProduct);

export default router;
