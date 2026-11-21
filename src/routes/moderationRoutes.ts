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
  submitReport,
  submitAccountDeletion,
  getMyAccountDeletionStatus,
  cancelMyAccountDeletion,
} from '../controllers/moderationController.js';
import { verifyToken, optionalVerifyToken, isAdmin } from '../middlewares/authMiddleware.js';
import { validateZod } from '../middlewares/validatorMiddleware.js';
import { handleReportActionSchema, handleDeletionActionSchema } from '../validators/schemas.js';

const router = express.Router();

// Submission & Status Endpoints (Pengguna / Mobile)
router.post('/report', optionalVerifyToken, submitReport);
router.get('/account-deletion/me', verifyToken, getMyAccountDeletionStatus);
router.post('/account-deletion', verifyToken, submitAccountDeletion);
router.delete('/account-deletion/me', verifyToken, cancelMyAccountDeletion);

// Tab 1: Laporan Pelanggaran (Admin Only)
router.get('/reports', verifyToken, isAdmin, getReports);
router.put('/reports/:id/action', verifyToken, isAdmin, validateZod(handleReportActionSchema), handleReportAction);

// Tab 2: Pengajuan Hapus Akun (Admin Only)
router.get('/account-deletions', verifyToken, isAdmin, getDeletionRequests);
router.put('/account-deletions/:id/action', verifyToken, isAdmin, validateZod(handleDeletionActionSchema), handleDeletionAction);

export default router;
