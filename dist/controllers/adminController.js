"use strict";
// ============================================================
//  src/controllers/adminController.ts
//  Controller Admin — manajemen user dan master data
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminTransactions = exports.handleWithdrawalAction = exports.getWithdrawals = exports.verifyMitraStore = exports.getVerifikasiList = exports.createMasterData = exports.getMasterData = exports.forceLogoutUser = exports.updateUserStatus = exports.getAllUsers = exports.getDashboardStats = void 0;
const database_js_1 = __importDefault(require("../config/database.js"));
const pusher_js_1 = require("../utils/pusher.js");
const response_js_1 = require("../utils/response.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const walletService_js_1 = require("../services/walletService.js");
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
 * PATCH /api/admin/users/:id/force-logout
 * Menaikkan token_version → seluruh access & refresh token pengguna di
 * SEMUA perangkat langsung tidak berlaku (sesi diakhiri paksa).
 */
const forceLogoutUser = async (req, res) => {
    try {
        const userId = parseInt(req.params.id ?? '0');
        const [result] = await database_js_1.default.execute('UPDATE users SET token_version = token_version + 1, updated_at = NOW() WHERE id = ?', [userId]);
        if (result.affectedRows === 0) {
            (0, response_js_1.sendNotFound)(res, 'Pengguna tidak ditemukan.');
            return;
        }
        (0, response_js_1.sendSuccess)(res, { userId }, 'Sesi pengguna telah diakhiri dari semua perangkat.');
    }
    catch (err) {
        (0, response_js_1.sendError)(res, 'Gagal mengakhiri sesi pengguna.', 500, String(err));
    }
};
exports.forceLogoutUser = forceLogoutUser;
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
        m.rejection_reason,
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
        const { status, reason } = req.body;
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
        const isVerifiedVal = isApproved ? 1 : 2;
        const rejectionReason = isApproved ? null : (reason?.trim() || 'Dokumen belum lengkap atau tidak sesuai ketentuan.');
        // Update status di tabel mitra_profiles
        await database_js_1.default.execute('UPDATE mitra_profiles SET is_verified = ?, is_active = 1, rejection_reason = ?, updated_at = NOW() WHERE id = ?', [isVerifiedVal, rejectionReason, mitraId]);
        // Update status akun user di tabel users (tetap aktif agar bisa login & melengkapi dokumen)
        await database_js_1.default.execute('UPDATE users SET is_active = 1, updated_at = NOW() WHERE id = ?', [userId]);
        // Kirim notifikasi realtime via Pusher Channels ke mitra terkait
        try {
            await pusher_js_1.pusher.trigger([`user-${userId}`, `mitra-${mitraId}`, 'mitra-verification'], 'verification-status-updated', {
                mitraId,
                userId,
                status,
                is_verified: isVerifiedVal,
                rejection_reason: rejectionReason,
                timestamp: new Date().toISOString(),
            });
            console.log(`[Pusher Backend] Event 'verification-status-updated' berhasil dikirim ke user-${userId}`);
        }
        catch (pusherErr) {
            console.warn('⚠️ Pusher trigger error pada verifikasi mitra:', pusherErr);
        }
        const message = isApproved
            ? 'Toko mitra berhasil disetujui.'
            : 'Pengajuan toko mitra telah ditolak.';
        (0, response_js_1.sendSuccess)(res, { mitraId, status, rejectionReason }, message);
    }
    catch (err) {
        (0, response_js_1.sendError)(res, 'Gagal memproses verifikasi toko mitra.', 500, String(err));
    }
};
exports.verifyMitraStore = verifyMitraStore;
// ============================================================
// WITHDRAWAL — persetujuan tarik saldo mitra
// ============================================================
/**
 * GET /api/admin/withdrawals?status=pending
 */
const getWithdrawals = async (req, res) => {
    try {
        const status = req.query['status'] || undefined;
        const rows = await (0, walletService_js_1.adminListWithdrawals)(status, Number(req.query['limit'] || 50));
        (0, response_js_1.sendSuccess)(res, rows, 'Daftar pengajuan penarikan berhasil diambil.');
    }
    catch (err) {
        (0, response_js_1.sendError)(res, 'Gagal mengambil daftar penarikan.', 500, String(err));
    }
};
exports.getWithdrawals = getWithdrawals;
/**
 * PATCH /api/admin/withdrawals/:id
 * Body: { action: 'approve' | 'reject', admin_note? }
 */
const handleWithdrawalAction = async (req, res) => {
    try {
        const admin = (0, authMiddleware_js_1.getAuthLocals)(res);
        const requestId = Number(req.params.id);
        const { action, admin_note } = req.body;
        if (action !== 'approve' && action !== 'reject') {
            (0, response_js_1.sendBadRequest)(res, "Field action harus 'approve' atau 'reject'.");
            return;
        }
        const result = await (0, walletService_js_1.adminHandleWithdrawal)(admin.userId, requestId, action, admin_note);
        (0, response_js_1.sendSuccess)(res, result, action === 'approve'
            ? 'Penarikan disetujui. Segera transfer dana ke rekening mitra.'
            : 'Penarikan ditolak dan saldo dikembalikan.');
    }
    catch (err) {
        (0, response_js_1.sendError)(res, err.message || 'Gagal memproses pengajuan.', err.status || 500);
    }
};
exports.handleWithdrawalAction = handleWithdrawalAction;
// ============================================================
// TRANSAKSI LINTAS TOKO — daftar transaksi nyata (Midtrans + DB)
// ============================================================
/**
 * GET /api/admin/transactions?status=&q=&page=1&limit=50
 */
const getAdminTransactions = async (req, res) => {
    try {
        const statusFilter = String(req.query['status'] || '').trim().toLowerCase();
        const search = String(req.query['q'] || '').trim();
        const page = Math.max(1, Number(req.query['page'] || 1));
        const limit = Math.min(200, Math.max(1, Number(req.query['limit'] || 50)));
        const offset = (page - 1) * limit;
        const whereParts = ['o.id IS NOT NULL'];
        const params = [];
        if (statusFilter && statusFilter !== 'semua' && statusFilter !== 'all') {
            if (statusFilter === 'failed') {
                whereParts.push("t.status IN ('failed', 'cancelled')");
            }
            else if (statusFilter === 'success' || statusFilter === 'paid') {
                whereParts.push("t.status = 'success'");
            }
            else if (statusFilter === 'pending') {
                whereParts.push("t.status = 'pending'");
            }
            else if (statusFilter === 'cancelled' || statusFilter === 'expired') {
                whereParts.push("t.status IN ('failed', 'cancelled')");
            }
        }
        if (search) {
            whereParts.push('(t.reference_code LIKE ? OR t.gateway_order_id LIKE ? OR m.store_name LIKE ? OR u.name LIKE ?)');
            const pattern = `%${search}%`;
            params.push(pattern, pattern, pattern, pattern);
        }
        const whereClause = `WHERE ${whereParts.join(' AND ')}`;
        const [countRows] = await database_js_1.default.query(`SELECT COUNT(*) AS total
       FROM transactions t
       LEFT JOIN orders o ON o.transaction_id = t.id
       LEFT JOIN mitra_profiles m ON o.mitra_id = m.id
       LEFT JOIN users u ON o.user_id = u.id
       ${whereClause}`, params);
        const total = Number(countRows?.[0]?.total ?? 0);
        const [rows] = await database_js_1.default.query(`SELECT
         t.id,
         t.reference_code,
         t.gateway,
         t.gateway_order_id,
         t.transaction_type AS payment_method,
         t.payment_type,
         t.bank,
         t.amount AS base_amount,
         t.gateway_fee,
         t.status AS payment_status,
         t.paid_at,
         t.expiry_time,
         t.created_at,
         o.id AS order_id,
         o.status AS order_status,
         m.store_name,
         u.name AS customer_name,
         u.email AS customer_email
       FROM transactions t
       LEFT JOIN orders o ON o.transaction_id = t.id
       LEFT JOIN mitra_profiles m ON o.mitra_id = m.id
       LEFT JOIN users u ON o.user_id = u.id
       ${whereClause}
       ORDER BY t.id DESC
       LIMIT ? OFFSET ?`, [...params, limit, offset]);
        const transactions = (rows || []).map((r) => {
            const baseAmount = Number(r.base_amount || 0);
            const gatewayFee = Number(r.gateway_fee || 0);
            return {
                id: r.reference_code || `TRX-${r.id}`,
                transaction_id: r.id,
                order_id: r.order_id,
                reference_code: r.reference_code,
                gateway: r.gateway || 'midtrans',
                gateway_order_id: r.gateway_order_id || null,
                store: r.store_name || '-',
                customer: r.customer_name || 'Customer',
                customer_email: r.customer_email || null,
                payment_method: r.payment_method || '-',
                payment_type: r.payment_type || null,
                bank: r.bank || null,
                base_amount: baseAmount,
                gateway_fee: gatewayFee,
                amount: baseAmount + gatewayFee,
                status: r.payment_status === 'cancelled' ? 'failed' : r.payment_status,
                raw_status: r.payment_status,
                order_status: r.order_status,
                paid_at: r.paid_at,
                expiry_time: r.expiry_time,
                date: r.paid_at || r.created_at,
            };
        });
        (0, response_js_1.sendSuccess)(res, transactions, 'Daftar transaksi berhasil diambil.', 200, {
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        });
    }
    catch (err) {
        (0, response_js_1.sendError)(res, 'Gagal mengambil daftar transaksi.', 500, String(err));
    }
};
exports.getAdminTransactions = getAdminTransactions;
//# sourceMappingURL=adminController.js.map