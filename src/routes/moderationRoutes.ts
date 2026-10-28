// ============================================================
//  src/routes/moderationRoutes.ts
//  Router Moderasi & Pengaduan Akun (Admin Only)
// ============================================================

import express from 'express';
import {
  getReports,
  handleReportAction,
  getDeletionRequests,
  handleDeletionAction,
} from '../controllers/moderationController.js';
import { verifyToken, isAdmin } from '../middlewares/authMiddleware.js';
import { validateZod } from '../middlewares/validatorMiddleware.js';
import { handleReportActionSchema, handleDeletionActionSchema } from '../validators/schemas.js';

const router = express.Router();

// Middleware: Hanya admin yang bisa mengakses rute ini
router.use(verifyToken, isAdmin);

// Tab 1: Laporan Pelanggaran
router.get('/reports', getReports);
router.put('/reports/:id/action', validateZod(handleReportActionSchema), handleReportAction);

// Tab 2: Pengajuan Hapus Akun
router.get('/account-deletions', getDeletionRequests);
router.put('/account-deletions/:id/action', validateZod(handleDeletionActionSchema), handleDeletionAction);

export default router;
