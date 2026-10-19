"use strict";
// ============================================================
//  src/routes/adminRoutes.ts
//  Router Modular: Admin — RBAC, hanya role 'admin'
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController = __importStar(require("../controllers/adminController.js"));
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const validatorMiddleware_js_1 = require("../middlewares/validatorMiddleware.js");
const router = (0, express_1.Router)();
/**
 * @route   GET /api/admin/dashboard-stats
 * @desc    Mendapatkan ringkasan statistik dan aktivitas dashboard admin
 * @access  Admin (atau public untuk dev/test)
 */
router.get('/dashboard-stats', adminController.getDashboardStats);
// Semua route di bawah ini memerlukan autentikasi + role admin
router.use(authMiddleware_js_1.verifyToken, (0, authMiddleware_js_1.requireRole)(['admin']));
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
router.patch('/users/:id/status', (0, validatorMiddleware_js_1.validateBody)([{ field: 'is_active', required: true, type: 'boolean' }]), adminController.updateUserStatus);
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
router.post('/master-data', (0, validatorMiddleware_js_1.validateBody)([
    { field: 'category', required: true, type: 'string', minLength: 1, maxLength: 50 },
    { field: 'key', required: true, type: 'string', minLength: 1, maxLength: 100 },
    { field: 'value', required: true, type: 'string', minLength: 1 },
]), adminController.createMasterData);
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
router.patch('/verifikasi/:id', (0, validatorMiddleware_js_1.validateBody)([{ field: 'status', required: true, type: 'string' }]), adminController.verifyMitraStore);
exports.default = router;
//# sourceMappingURL=adminRoutes.js.map