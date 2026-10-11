// ============================================================
//  src/routes/aiRoutes.ts
//  Router Modular: AI Analisis — mitra & admin
// ============================================================

import { Router } from 'express';
import * as aiController from '../controllers/aiController.js';
import { verifyToken, requireRole } from '../middlewares/authMiddleware.js';
import {
  validateBody,
  aiAnalysisValidationRules,
} from '../middlewares/validatorMiddleware.js';

const router = Router();

// Semua route AI memerlukan autentikasi
router.use(verifyToken);

/**
 * @route   POST /api/ai/analyze
 * @desc    Menjalankan analisis AI untuk konteks bisnis keramik
 * @access  Protected (mitra & admin)
 */
router.post(
  '/analyze',
  requireRole(['mitra', 'admin']),
  validateBody(aiAnalysisValidationRules),
  aiController.analyzeWithAI
);

/**
 * @route   GET /api/ai/history
 * @desc    Riwayat analisis AI milik pengguna yang sedang login
 * @access  Protected (semua role)
 */
router.get('/history', aiController.getAiHistory);

export default router;
