import express from 'express';
import {
  getReports,
  handleReportAction,
  getDeletionRequests,
  handleDeletionAction,
  submitReport,
  submitAccountDeletion
} from '../controllers/moderationController.js';
import { verifyToken, isAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Submission Endpoints (Dapat diakses pengguna / mobile)
router.post('/report', submitReport);
router.post('/account-deletion', submitAccountDeletion);

// Tab 1: Laporan Pelanggaran (Admin Only)
router.get('/reports', verifyToken, isAdmin, getReports);
router.put('/reports/:id/action', verifyToken, isAdmin, handleReportAction);

// Tab 2: Pengajuan Hapus Akun (Admin Only)
router.get('/account-deletions', verifyToken, isAdmin, getDeletionRequests);
router.put('/account-deletions/:id/action', verifyToken, isAdmin, handleDeletionAction);

export default router;
