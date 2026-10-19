"use strict";
// ============================================================
//  src/controllers/adminController.ts
//  Controller Admin — manajemen user dan master data
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyMitraStore = exports.getVerifikasiList = exports.createMasterData = exports.getMasterData = exports.updateUserStatus = exports.getAllUsers = exports.getDashboardStats = void 0;
const database_js_1 = __importDefault(require("../config/database.js"));
const response_js_1 = require("../utils/response.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const sanitizeUser = (user) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash, token_version, ...safe } = user;
    return safe;
};
/**
 * GET /api/admin/dashboard-stats
 * Ringkasan statistik dan aktivitas dashboard admin
 */
const getDashboardStats = async (_req, res) => {
    try {
        // 1. Toko Pengrajin Aktif (Terverifikasi & Aktif)
        const [tokoAktifRows] = await database_js_1.default.execute('SELECT COUNT(*) AS total FROM mitra_profiles WHERE is_verified = 1 AND is_active = 1');
        const tokoPengrajinAktif = Number(tokoAktifRows[0]?.total ?? 0);
        // 2. Pengajuan Toko Baru (Menunggu Verifikasi)
        const [tokoPendingRows] = await database_js_1.default.execute('SELECT COUNT(*) AS total FROM mitra_profiles WHERE is_verified = 0');
        const pengajuanTokoBaru = Number(tokoPendingRows[0]?.total ?? 0);
        // 3. Total Transaksi & Omzet dari tabel orders (dan fallback transactions jika ada)
        const [orderStatsRows] = await database_js_1.default.execute(`SELECT 
        COUNT(*) AS totalTransaksi,
        COALESCE(SUM(total_amount), 0) AS totalOmzet
       FROM orders
       WHERE status != 'cancelled'`);
        let totalTransaksi = Number(orderStatsRows[0]?.totalTransaksi ?? 0);
        let totalOmzet = Number(orderStatsRows[0]?.totalOmzet ?? 0);
        // Jika orders kosong, periksa tabel transactions
        if (totalTransaksi === 0) {
            const [trxStatsRows] = await database_js_1.default.execute(`SELECT 
          COUNT(*) AS totalTransaksi,
          COALESCE(SUM(amount), 0) AS totalOmzet
         FROM transactions
         WHERE status = 'success'`);
            totalTransaksi = Number(trxStatsRows[0]?.totalTransaksi ?? 0);
            totalOmzet = Number(trxStatsRows[0]?.totalOmzet ?? 0);
        }
        // 4. Kunjungan Wisatawan (Total pengunjung unik dari log / pembeli)
        const [visitorRows] = await database_js_1.default.execute(`SELECT COUNT(DISTINCT ip_address) AS total FROM audit_logs WHERE ip_address IS NOT NULL`);
        let kunjunganWisatawan = Number(visitorRows[0]?.total ?? 0);
        if (kunjunganWisatawan === 0) {
            const [userCountRows] = await database_js_1.default.execute(`SELECT COUNT(*) AS total FROM users WHERE role = 'buyer'`);
            kunjunganWisatawan = Number(userCountRows[0]?.total ?? 0);
        }
        // 5. Transaksi Terbaru
        const [latestOrders] = await database_js_1.default.execute(`SELECT 
        COALESCE(o.tracking_number, CONCAT('INV/', DATE_FORMAT(o.created_at, '%Y/%m/'), LPAD(o.id, 4, '0'))) AS id,
        COALESCE(m.store_name, 'Toko Mitra') AS toko,
        CAST(o.total_amount AS UNSIGNED) AS nominal
       FROM orders o
       LEFT JOIN mitra_profiles m ON o.mitra_id = m.id
       ORDER BY o.created_at DESC
       LIMIT 5`);
        let transaksiTerbaru = (latestOrders || []).map((row) => ({
            id: String(row.id),
            toko: String(row.toko),
            nominal: Number(row.nominal || 0)
        }));
        if (transaksiTerbaru.length === 0) {
            const [latestTransactions] = await database_js_1.default.execute(`SELECT 
          COALESCE(t.reference_code, CONCAT('TRX/', DATE_FORMAT(t.created_at, '%Y/%m/'), LPAD(t.id, 4, '0'))) AS id,
          'Transaksi Platform' AS toko,
          CAST(t.amount AS UNSIGNED) AS nominal
         FROM transactions t
         ORDER BY t.created_at DESC
         LIMIT 5`);
            transaksiTerbaru = (latestTransactions || []).map((row) => ({
                id: String(row.id),
                toko: String(row.toko),
                nominal: Number(row.nominal || 0)
            }));
        }
        const dashboardData = {
            totalTransaksi,
            totalOmzet,
            kunjunganWisatawan,
            tokoPengrajinAktif,
            pengajuanTokoBaru,
            transaksiTerbaru
        };
        res.status(200).json({
            success: true,
            data: dashboardData
        });
    }
    catch (error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).json({ success: false, message: "Terjadi kesalahan pada server" });
    }
};
exports.getDashboardStats = getDashboardStats;
/**
 * GET /api/admin/users
 */
const getAllUsers = async (_req, res) => {
    try {
        const page = Math.max(1, parseInt(_req.query['page']) || 1);
        const limit = Math.min(100, parseInt(_req.query['limit']) || 20);
        const offset = (page - 1) * limit;
        const [rows] = await database_js_1.default.execute(`SELECT id, name, email, role, is_active, created_at, updated_at
       FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset]);
        const [countRows] = await database_js_1.default.execute('SELECT COUNT(*) as total FROM users');
        const total = countRows[0]?.total ?? 0;
        (0, response_js_1.sendSuccess)(res, rows.map(sanitizeUser), 'Daftar pengguna berhasil diambil.', 200, {
            page, limit, total,
            totalPages: Math.ceil(total / limit),
        });
    }
    catch (err) {
        (0, response_js_1.sendError)(res, 'Gagal mengambil data pengguna.', 500, String(err));
    }
};
exports.getAllUsers = getAllUsers;
/**
 * PATCH /api/admin/users/:id/status
 */
const updateUserStatus = async (req, res) => {
    try {
        const userId = parseInt(req.params.id ?? '0');
        const { is_active } = req.body;
        if (typeof is_active !== 'boolean') {
            (0, response_js_1.sendBadRequest)(res, 'Field is_active harus berupa boolean.');
            return;
        }
        const [result] = await database_js_1.default.execute('UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?', [is_active, userId]);
        if (result.affectedRows === 0) {
            (0, response_js_1.sendNotFound)(res, 'Pengguna tidak ditemukan.');
            return;
        }
        (0, response_js_1.sendSuccess)(res, { userId, is_active }, 'Status pengguna berhasil diperbarui.');
    }
    catch (err) {
        (0, response_js_1.sendError)(res, 'Gagal memperbarui status pengguna.', 500, String(err));
    }
};
exports.updateUserStatus = updateUserStatus;
/**
 * GET /api/admin/master-data
 */
const getMasterData = async (req, res) => {
    try {
        const category = req.query['category'];
        const query = category
            ? 'SELECT * FROM master_data WHERE category = ? ORDER BY `key` ASC'
            : 'SELECT * FROM master_data ORDER BY category ASC, `key` ASC';
        const params = category ? [category] : [];
        const [rows] = await database_js_1.default.execute(query, params);
        (0, response_js_1.sendSuccess)(res, rows, 'Data master berhasil diambil.');
    }
    catch (err) {
        (0, response_js_1.sendError)(res, 'Gagal mengambil data master.', 500, String(err));
    }
};
exports.getMasterData = getMasterData;
/**
 * POST /api/admin/master-data
 */
const createMasterData = async (req, res) => {
    try {
        const { userId } = (0, authMiddleware_js_1.getAuthLocals)(res);
        const { category, key, value, description } = req.body;
        const [result] = await database_js_1.default.execute(`INSERT INTO master_data (category, \`key\`, value, description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`, [category, key, value, description ?? null, userId]);
        (0, response_js_1.sendSuccess)(res, { id: result.insertId, category, key, value }, 'Data master berhasil dibuat.', 201);
    }
    catch (err) {
        (0, response_js_1.sendError)(res, 'Gagal membuat data master.', 500, String(err));
    }
};
exports.createMasterData = createMasterData;
/**
 * GET /api/admin/verifikasi
 * Mendapatkan daftar semua pengajuan verifikasi toko mitra
 */
const getVerifikasiList = async (_req, res) => {
    try {
        const [rows] = await database_js_1.default.execute(`SELECT 
        m.id, 
        m.user_id, 
        m.store_name, 
        m.workshop_address, 
        m.started_year, 
        m.whatsapp_number, 
        m.description,
        m.website,
        m.instagram,
        m.ktp_file_url, 
        m.nib_file_url, 
        m.is_verified, 
        m.is_active, 
        m.created_at, 
        u.name AS owner_name, 
        u.email
       FROM mitra_profiles m
       JOIN users u ON m.user_id = u.id
       ORDER BY m.created_at DESC`);
        (0, response_js_1.sendSuccess)(res, rows, 'Daftar pengajuan verifikasi toko berhasil diambil.');
    }
    catch (err) {
        (0, response_js_1.sendError)(res, 'Gagal mengambil data verifikasi toko.', 500, String(err));
    }
};
exports.getVerifikasiList = getVerifikasiList;
/**
 * PATCH /api/admin/verifikasi/:id
 * Setujui ('approved') atau tolak ('rejected') verifikasi toko mitra
 */
const verifyMitraStore = async (req, res) => {
    try {
        const mitraId = parseInt(req.params.id ?? '0');
        const { status } = req.body;
        if (!['approved', 'rejected'].includes(status)) {
            (0, response_js_1.sendBadRequest)(res, "Status verifikasi harus 'approved' atau 'rejected'.");
            return;
        }
        // Cek keberadaan profil mitra
        const [rows] = await database_js_1.default.execute('SELECT user_id FROM mitra_profiles WHERE id = ?', [mitraId]);
        if (!rows.length) {
            (0, response_js_1.sendNotFound)(res, 'Data pengajuan toko mitra tidak ditemukan.');
            return;
        }
        const userId = rows[0].user_id;
        const isApproved = status === 'approved';
        const isVerifiedVal = isApproved ? 1 : 0;
        const isActiveVal = isApproved ? 1 : 0;
        // Update status di tabel mitra_profiles
        await database_js_1.default.execute('UPDATE mitra_profiles SET is_verified = ?, is_active = ?, updated_at = NOW() WHERE id = ?', [isVerifiedVal, isActiveVal, mitraId]);
        // Update status akun user di tabel users
        await database_js_1.default.execute('UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?', [isActiveVal, userId]);
        const message = isApproved
            ? 'Toko mitra berhasil disetujui.'
            : 'Pengajuan toko mitra telah ditolak.';
        (0, response_js_1.sendSuccess)(res, { mitraId, status }, message);
    }
    catch (err) {
        (0, response_js_1.sendError)(res, 'Gagal memproses verifikasi toko mitra.', 500, String(err));
    }
};
exports.verifyMitraStore = verifyMitraStore;
//# sourceMappingURL=adminController.js.map