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
const aiSettingController_js_1 = require("../controllers/aiSettingController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const validatorMiddleware_js_1 = require("../middlewares/validatorMiddleware.js");
const router = (0, express_1.Router)();
/**
 * @route   GET /api/admin/dashboard-stats
 * @desc    Mendapatkan ringkasan statistik dan aktivitas dashboard admin
 */
router.get('/dashboard-stats', adminController.getDashboardStats);
/**
 * @route   GET /api/admin/ai-settings
 * @desc    Mendapatkan konfigurasi AI Assistant
 */
router.get('/ai-settings', aiSettingController_js_1.getAiSettings);
/**
 * @route   PUT /api/admin/ai-settings
 * @desc    Menyimpan / memperbarui konfigurasi AI Assistant
 */
router.put('/ai-settings', aiSettingController_js_1.updateAiSettings);
// Semua route di bawah ini memerlukan autentikasi + role admin
router.use(authMiddleware_js_1.verifyToken, (0, authMiddleware_js_1.requireRole)(['admin']));
// Transaksi Lintas Toko
router.get('/transactions', adminController.getAdminTransactions);
// Manajemen Pengguna
router.get('/users', adminController.getAllUsers);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.patch('/users/:id/status', (0, validatorMiddleware_js_1.validateBody)([{ field: 'is_active', required: true, type: 'boolean' }]), adminController.updateUserStatus);
// Master Data
router.get('/master-data', adminController.getMasterData);
router.post('/master-data', (0, validatorMiddleware_js_1.validateBody)([
    { field: 'category', required: true, type: 'string', minLength: 1, maxLength: 50 },
    { field: 'key', required: true, type: 'string', minLength: 1, maxLength: 100 },
    { field: 'value', required: true, type: 'string', minLength: 1 },
]), adminController.createMasterData);
// Verifikasi & Manajemen Toko Mitra
router.get('/verifikasi', adminController.getVerifikasiList);
router.patch('/verifikasi/:id', (0, validatorMiddleware_js_1.validateBody)([{ field: 'status', required: true, type: 'string' }]), adminController.verifyMitraStore);
router.patch('/stores/:id/status', adminController.updateStoreStatus);
router.delete('/stores/:id', adminController.deleteStore);
// Manajemen Kategori Produk
router.get('/categories', adminController.getCategories);
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);
// Manajemen Jadwal Kunjungan Edukasi
router.get('/schedules', adminController.getSchedules);
router.post('/schedules', adminController.createSchedule);
router.put('/schedules/:id', adminController.updateSchedule);
router.delete('/schedules/:id', adminController.deleteSchedule);
exports.default = router;
//# sourceMappingURL=adminRoutes.js.map