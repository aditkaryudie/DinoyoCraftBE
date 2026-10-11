// ============================================================
//  src/routes/index.ts
//  Central Router — mendaftarkan semua router modular
// ============================================================

import { Router } from 'express';
import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import aiRoutes from './aiRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/ai', aiRoutes);

export default router;
