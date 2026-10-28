// ============================================================
//  src/routes/orderRoutes.ts
//  Router Transaksi & Pesanan
// ============================================================

import { Router } from 'express';
import {
  checkout,
  getUserOrders,
  getOrderById,
  getMitraOrders,
  updateOrderStatus,
} from '../controllers/orderController.js';
import { verifyToken, requireRole } from '../middlewares/authMiddleware.js';
import { validateZod } from '../middlewares/validatorMiddleware.js';
import { checkoutOrderSchema, updateOrderStatusSchema } from '../validators/schemas.js';

const router = Router();

// Semua rute pesanan wajib login
router.use(verifyToken);

// Customer Checkout & History
router.post('/checkout', validateZod(checkoutOrderSchema), checkout);
router.get('/', getUserOrders);

// Toko Mitra: Ambil pesanan yang masuk ke tokonya
router.get('/mitra', requireRole(['mitra', 'admin']), getMitraOrders);

// Detail Pesanan & Update Status
router.get('/:id', getOrderById);
router.patch('/:id/status', validateZod(updateOrderStatusSchema), updateOrderStatus);

export default router;

