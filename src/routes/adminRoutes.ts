// ============================================================
//  src/routes/adminRoutes.ts
//  Router Modular: Admin — RBAC, hanya role 'admin'
// ============================================================

import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import * as systemLogController from '../controllers/systemLogController.js';
import { getAiSettings, updateAiSettings } from '../controllers/aiSettingController.js';
import { verifyToken, requireRole } from '../middlewares/authMiddleware.js';
import { validateZod } from '../middlewares/validatorMiddleware.js';
import {
  updateUserStatusSchema,
  createMasterDataSchema,
  verifyMitraStoreSchema,
} from '../validators/schemas.js';

const router = Router();

/**
 * @route   GET /api/admin/dashboard-stats
 * @desc    Mendapatkan ringkasan statistik dan aktivitas dashboard admin
 * @access  Admin (atau public untuk dev/test)
 */
router.get('/dashboard-stats', adminController.getDashboardStats);

/**
 * @route   GET /api/admin/ai-settings
 * @desc    Mendapatkan konfigurasi AI Assistant
 * @access  Admin
 */
router.get('/ai-settings', getAiSettings);

/**
 * @route   PUT /api/admin/ai-settings
 * @desc    Menyimpan / memperbarui konfigurasi AI Assistant
 * @access  Admin
 */
router.put('/ai-settings', updateAiSettings);

// Semua route di bawah ini memerlukan autentikasi + role admin
router.use(verifyToken, requireRole(['admin']));

/**
 * @route   GET /api/admin/users
 * @desc    Mendapatkan semua pengguna (dengan paginasi)
 * @access  Admin only
 */
router.get('/users', adminController.getAllUsers);

/**
 * @route   PATCH /api/admin/users/:id/status
 * @desc    Mengaktifkan / menonaktifkan akun pengguna
 * @access  Admin only
 */
router.patch(
  '/users/:id/status',
  validateZod(updateUserStatusSchema),
  adminController.updateUserStatus
);

/**
 * @route   PATCH /api/admin/users/:id/force-logout
 * @desc    Mengakhiri seluruh sesi pengguna di semua perangkat (token_version +1)
 * @access  Admin only
 */
router.patch('/users/:id/force-logout', adminController.forceLogoutUser);

/**
 * @route   GET /api/admin/transactions
 * @desc    Daftar seluruh transaksi lintas toko beserta status Midtrans & paid_at
 * @access  Admin only
 */
router.get('/transactions', adminController.getAdminTransactions);

/**
 * @route   GET /api/admin/withdrawals?status=pending
 * @desc    Daftar pengajuan tarik saldo mitra
 * @access  Admin only
 */
router.get('/withdrawals', adminController.getWithdrawals);

/**
 * @route   PATCH /api/admin/withdrawals/:id
 * @desc    Setujui / tolak pengajuan penarikan
 * @access  Admin only
 */
router.patch('/withdrawals/:id', adminController.handleWithdrawalAction);

/**
 * @route   GET /api/admin/master-data
 * @desc    Mendapatkan data master (opsional filter by category)
 * @access  Admin only
 */
router.get('/master-data', adminController.getMasterData);

/**
 * @route   POST /api/admin/master-data
 * @desc    Membuat data master baru
 * @access  Admin only
 */
router.post(
  '/master-data',
  validateZod(createMasterDataSchema),
  adminController.createMasterData
);

/**
 * @route   GET /api/admin/verifikasi
 * @desc    Mendapatkan daftar pengajuan verifikasi toko mitra
 * @access  Admin only
 */
router.get('/verifikasi', adminController.getVerifikasiList);

/**
 * @route   PATCH /api/admin/verifikasi/:id
 * @desc    Setujui / tolak verifikasi toko mitra
 * @access  Admin only
 */
router.patch(
  '/verifikasi/:id',
  validateZod(verifyMitraStoreSchema),
  adminController.verifyMitraStore
);

// ============================================================
//  SYSTEM LOGS & LIVE MONITORING (PRD §11 — Admin Only)
// ============================================================
router.get('/logs', systemLogController.getSystemLogs);
router.get('/logs/summary', systemLogController.getSystemLogsSummary);
router.get('/logs/export', systemLogController.exportSystemLogsCsv);
router.post('/logs/bulk-delete', systemLogController.bulkDeleteSystemLogs);
router.post('/logs/pusher-auth', systemLogController.authorizePusherChannel);
router.get('/logs/:eventId', systemLogController.getSystemLogDetail);
router.get('/logs/:eventId/related', systemLogController.getRelatedSystemLogs);
router.post('/logs/:eventId/acknowledge', systemLogController.acknowledgeSystemLog);
router.post('/logs/:eventId/restore', systemLogController.restoreSystemLog);
router.delete('/logs/:eventId/purge', systemLogController.purgeSystemLog);
router.delete('/logs/:eventId', systemLogController.softDeleteSystemLog);

export default router;
