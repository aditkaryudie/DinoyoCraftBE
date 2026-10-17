// ============================================================
//  src/routes/adminRoutes.ts
//  Router Modular: Admin — RBAC, hanya role 'admin'
// ============================================================

import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import { verifyToken, requireRole } from '../middlewares/authMiddleware.js';
import { validateBody } from '../middlewares/validatorMiddleware.js';

const router = Router();

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
  validateBody([{ field: 'is_active', required: true, type: 'boolean' }]),
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
  validateBody([
    { field: 'category', required: true, type: 'string', minLength: 1, maxLength: 50 },
    { field: 'key', required: true, type: 'string', minLength: 1, maxLength: 100 },
    { field: 'value', required: true, type: 'string', minLength: 1 },
  ]),
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
  validateBody([{ field: 'status', required: true, type: 'string' }]),
  adminController.verifyMitraStore
);

export default router;
