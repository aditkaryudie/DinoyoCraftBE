// ============================================================
//  src/routes/index.ts
//  Central Router — mendaftarkan semua router modular
// ============================================================

import { Router } from 'express';
import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import aiRoutes from './aiRoutes.js';
import productRoutes from './productRoutes.js';
import mitraRoutes from './mitraRoutes.js';
import chatRoutes from './chatRoutes.js';
import moderationRoutes from './moderationRoutes.js';
import addressRoutes from './addressRoutes.js';
import cartRoutes from './cartRoutes.js';
import orderRoutes from './orderRoutes.js';
import reviewRoutes from './reviewRoutes.js';
import notificationRoutes from './notificationRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/admin/moderation', moderationRoutes);
router.use('/moderation', moderationRoutes);
router.use('/ai', aiRoutes);
router.use('/products', productRoutes);
router.use('/mitra', mitraRoutes);
router.use('/chat', chatRoutes);

// Rute Fungsional E-Commerce
router.use('/addresses', addressRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/reviews', reviewRoutes);
router.use('/notifications', notificationRoutes);

export default router;
