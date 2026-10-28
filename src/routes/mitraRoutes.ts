// ============================================================
//  src/routes/mitraRoutes.ts
//  Router Dashboard & Pengelolaan Toko Mitra
// ============================================================

import express from 'express';
import { getDashboardMitra, getFinanceReport, getOrders, updateProduct } from '../controllers/mitraController.js';
import { getStoreProfile } from '../controllers/storeController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { validateZod } from '../middlewares/validatorMiddleware.js';
import { updateProductSchema } from '../validators/schemas.js';

const router = express.Router();

router.get('/dashboard', verifyToken, getDashboardMitra);
router.get('/store-profile', verifyToken, getStoreProfile);
router.get('/finance', verifyToken, getFinanceReport);
router.get('/orders', verifyToken, getOrders);
router.put('/products/:id', verifyToken, validateZod(updateProductSchema), updateProduct);

export default router;
