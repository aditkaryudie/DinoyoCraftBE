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

const router = Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/admin/moderation', moderationRoutes);
router.use('/moderation', moderationRoutes);
router.use('/ai', aiRoutes);
router.use('/products', productRoutes);
router.use('/mitra', mitraRoutes);
router.use('/chat', chatRoutes);

export default router;
