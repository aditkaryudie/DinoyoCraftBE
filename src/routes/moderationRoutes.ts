import express from 'express';
import {
  getReports,
  handleReportAction,
  getDeletionRequests,
  handleDeletionAction
} from '../controllers/moderationController.js';
import { verifyToken, isAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Middleware: Hanya admin yang bisa mengakses rute ini
router.use(verifyToken, isAdmin);

// Tab 1: Laporan Pelanggaran
router.get('/reports', getReports);
router.put('/reports/:id/action', handleReportAction);

// Tab 2: Pengajuan Hapus Akun
router.get('/account-deletions', getDeletionRequests);
router.put('/account-deletions/:id/action', handleDeletionAction);

export default router;
