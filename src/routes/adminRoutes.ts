// ============================================================
//  src/routes/adminRoutes.ts
//  Router Modular: Admin — RBAC, hanya role 'admin'
// ============================================================

import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
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

export default router;
