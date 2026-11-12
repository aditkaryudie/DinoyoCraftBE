"use strict";
// ============================================================
//  src/services/walletService.ts
//  Saldo & Penarikan Dana Mitra (Wallet Ledger).
//  Saldo = total pesanan SELESAI − penarikan (pending + approved).
//  Penarikan diajukan mitra dan LANGSUNG DIPROSES (status 'approved')
//  tanpa perlu approval admin — cocok untuk demo tugas.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdrawalFee = exports.minWithdrawal = void 0;
exports.getWalletSummary = getWalletSummary;
exports.getWeeklyChart = getWeeklyChart;
exports.getMonthlyChart = getMonthlyChart;
exports.getMitraChart = getMitraChart;
exports.listWithdrawals = listWithdrawals;
exports.requestWithdrawal = requestWithdrawal;
exports.adminListWithdrawals = adminListWithdrawals;
exports.adminHandleWithdrawal = adminHandleWithdrawal;
const database_js_1 = __importDefault(require("../config/database.js"));
const notificationService_js_1 = require("./notificationService.js");
const COMPLETED_STATUSES = ['completed', 'delivered', 'selesai'];
const PENDING_EARN_STATUSES = ['paid', 'packed', 'shipped', 'processing'];
const minWithdrawal = () => Number(process.env['MIN_WITHDRAWAL'] || 50_000);
exports.minWithdrawal = minWithdrawal;
const withdrawalFee = () => Number(process.env['WITHDRAWAL_FEE'] || 0);
exports.withdrawalFee = withdrawalFee;
async function getMitraProfile(userId) {
    const [rows] = await database_js_1.default.query('SELECT id, user_id, store_name FROM mitra_profiles WHERE user_id = ? LIMIT 1', [userId]);
    return rows && rows.length > 0 ? rows[0] : null;
}
/** Ringkasan saldo mitra berdasarkan pesanan selesai & riwayat penarikan. */
async function getWalletSummary(mitraId) {
    const [earnRows] = await database_js_1.default.query(`SELECT
       COALESCE(SUM(CASE WHEN LOWER(status) IN (${COMPLETED_STATUSES.map(() => '?').join(',')}) THEN total_amount ELSE 0 END), 0) AS completed_total,
       COALESCE(SUM(CASE WHEN LOWER(status) IN (${PENDING_EARN_STATUSES.map(() => '?').join(',')}) THEN total_amount ELSE 0 END), 0) AS pending_total
     FROM orders
     WHERE mitra_id = ? AND status != 'cancelled'`, [...COMPLETED_STATUSES, ...PENDING_EARN_STATUSES, mitraId]);
    const [withdrawRows] = await database_js_1.default.query(`SELECT
       COALESCE(SUM(CASE WHEN status IN ('pending','approved') THEN amount ELSE 0 END), 0) AS locked_total,
       COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) AS withdrawn_total
     FROM withdrawal_requests
     WHERE mitra_id = ?`, [mitraId]);
    const completedTotal = Number(earnRows[0]?.completed_total || 0);
    const pendingTotal = Number(earnRows[0]?.pending_total || 0);
    const lockedTotal = Number(withdrawRows[0]?.locked_total || 0);
    const withdrawnTotal = Number(withdrawRows[0]?.withdrawn_total || 0);
    return {
        saldo_tersedia: Math.max(0, completedTotal - lockedTotal),
        pendapatan_tertunda: pendingTotal,
        total_ditarik: withdrawnTotal,
        min_withdrawal: (0, exports.minWithdrawal)(),
        withdrawal_fee: (0, exports.withdrawalFee)(),
    };
}
/**
 * Data grafik mingguan pendapatan mitra (7 hari terakhir).
 * Hasil query diagregasi per hari dan diparsing ke tipe Number asli
 * agar grafik frontend tidak datar akibat MySQL string casting pada SUM().
 */
async function getWeeklyChart(mitraId) {
    const [rows] = await database_js_1.default.query(`SELECT 
       DATE(created_at) AS tanggal,
       DATE_FORMAT(created_at, '%Y-%m-%d') AS tanggal_str,
       DAYNAME(created_at) AS hari,
       COALESCE(SUM(total_amount), 0) AS total_amount
     FROM orders
     WHERE mitra_id = ? 
       AND status != 'cancelled'
       AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
     GROUP BY DATE(created_at), DATE_FORMAT(created_at, '%Y-%m-%d'), DAYNAME(created_at)
     ORDER BY DATE(created_at) ASC`, [mitraId]);
    const rawMap = new Map();
    for (const r of rows) {
        const key = r.tanggal_str || (r.tanggal instanceof Date ? r.tanggal.toISOString().split('T')[0] : String(r.tanggal));
        rawMap.set(key, Number(r.total_amount) || 0);
    }
    const DAY_LABELS_ID = {
        Sunday: 'Min',
        Monday: 'Sen',
        Tuesday: 'Sel',
        Wednesday: 'Rab',
        Thursday: 'Kam',
        Friday: 'Jum',
        Saturday: 'Sab',
    };
    // Susun 7 hari berturut-turut sampai hari ini dengan data dasar
    const chartDays = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayNameEn = d.toLocaleDateString('en-US', { weekday: 'long' });
        const dayNameId = DAY_LABELS_ID[dayNameEn] || dayNameEn;
        const amount = Number(rawMap.get(dateStr) || 0);
        chartDays.push({
            tanggal: dateStr,
            hari: dayNameId,
            total_amount: amount,
        });
    }
    // Pemetaan baris kueri mentah dengan konversi tipe data Number
    const formattedChartData = chartDays.map((row) => ({
        ...row,
        total: Number(row.total_amount) || 0,
        total_amount: Number(row.total_amount) || 0,
    }));
    return formattedChartData;
}
/**
 * Data grafik bulanan pendapatan mitra (30 hari terakhir).
 * Hasil query diagregasi per hari dan diparsing ke tipe Number asli
 * agar grafik 30 hari di frontend tidak datar akibat MySQL string casting pada SUM().
 */
async function getMonthlyChart(mitraId) {
    const [rows] = await database_js_1.default.query(`SELECT 
       DATE(created_at) AS tanggal,
       DATE_FORMAT(created_at, '%Y-%m-%d') AS tanggal_str,
       DAY(created_at) AS hari,
       COALESCE(SUM(total_amount), 0) AS total_amount
     FROM orders
     WHERE mitra_id = ? 
       AND status != 'cancelled'
       AND created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
     GROUP BY DATE(created_at), DATE_FORMAT(created_at, '%Y-%m-%d'), DAY(created_at)
     ORDER BY DATE(created_at) ASC`, [mitraId]);
    const rawMap = new Map();
    for (const r of rows) {
        const key = r.tanggal_str || (r.tanggal instanceof Date ? r.tanggal.toISOString().split('T')[0] : String(r.tanggal));
        rawMap.set(key, Number(r.total_amount) || 0);
    }
    // Susun 30 hari berturut-turut sampai hari ini
    const monthlyDays = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayNumber = d.getDate();
        const amount = Number(rawMap.get(dateStr) || 0);
        monthlyDays.push({
            tanggal: dateStr,
            hari: String(dayNumber),
            label: `${dayNumber}`,
            total_amount: amount,
        });
    }
    // Pemetaan baris kueri dengan konversi tipe data Number
    const formattedMonthlyData = monthlyDays.map((row) => ({
        ...row,
        total: Number(row.total_amount) || 0,
        total_amount: Number(row.total_amount) || 0,
    }));
    return formattedMonthlyData;
}
/**
 * Helper fleksibel untuk mengambil data grafik mitra berdasarkan rentang waktu ('7' atau '30').
 */
async function getMitraChart(mitraId, range = '7') {
    if (range === '30' || range === '30hari') {
        return getMonthlyChart(mitraId);
    }
    return getWeeklyChart(mitraId);
}
/** Riwayat pengajuan penarikan milik mitra. */
async function listWithdrawals(mitraId, limit = 20) {
    const [rows] = await database_js_1.default.query(`SELECT id, amount, fee, bank_name, account_number, account_name,
            status, admin_note, processed_at, created_at
     FROM withdrawal_requests
     WHERE mitra_id = ?
     ORDER BY id DESC
     LIMIT ?`, [mitraId, limit]);
    return rows.map((r) => ({
        ...r,
        amount: Number(r.amount) || 0,
        fee: Number(r.fee) || 0,
    }));
}
/** Ajukan penarikan saldo. Melempar Error dengan pesan Indonesia bila tidak valid. */
async function requestWithdrawal(userId, params) {
    const mitra = await getMitraProfile(userId);
    if (!mitra) {
        throw Object.assign(new Error('Profil mitra tidak ditemukan.'), { status: 404 });
    }
    const amount = Math.round(Number(params.amount || 0));
    if (!amount || amount <= 0) {
        throw Object.assign(new Error('Nominal penarikan tidak valid.'), { status: 400 });
    }
    const min = (0, exports.minWithdrawal)();
    if (amount < min) {
        throw Object.assign(new Error(`Minimal penarikan adalah Rp ${min.toLocaleString('id-ID')}.`), { status: 400 });
    }
    const summary = await getWalletSummary(mitra.id);
    if (amount > summary.saldo_tersedia) {
        throw Object.assign(new Error(`Saldo tidak cukup. Saldo tersedia: Rp ${summary.saldo_tersedia.toLocaleString('id-ID')}.`), { status: 400 });
    }
    if (!params.bank_name?.trim() || !params.account_number?.trim() || !params.account_name?.trim()) {
        throw Object.assign(new Error('Nama bank, nomor rekening, dan nama pemilik rekening wajib diisi.'), { status: 400 });
    }
    const fee = (0, exports.withdrawalFee)();
    const connection = await database_js_1.default.getConnection();
    let insertId;
    try {
        await connection.beginTransaction();
        const [result] = await connection.query(`INSERT INTO withdrawal_requests
         (user_id, mitra_id, amount, fee, bank_name, account_number, account_name, status, processed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', NOW())`, [
            userId,
            mitra.id,
            amount,
            fee,
            params.bank_name.trim(),
            params.account_number.trim(),
            params.account_name.trim(),
        ]);
        insertId = result.insertId;
        // Langsung disetujui (tanpa approval admin) — saldo otomatis terkunci
        // karena status 'approved' ikut dihitung sebagai dana keluar.
        await connection.query(`INSERT INTO notifications (user_id, title, message, type, reference_id)
       VALUES (?, ?, ?, 'withdrawal', ?)`, [
            userId,
            'Penarikan Berhasil Diproses',
            `Penarikan Rp ${amount.toLocaleString('id-ID')} ke ${params.bank_name.trim()} ${params.account_number.trim()} telah diproses. Dana akan masuk sesuai ketentuan bank (1-2 hari kerja).`,
            insertId,
        ]);
        // Push FCM ke mitra (non-blocking).
        void (0, notificationService_js_1.sendPushNotificationToUser)(userId, 'Penarikan Berhasil Diproses', `Penarikan Rp ${amount.toLocaleString('id-ID')} ke ${params.bank_name.trim()} ${params.account_number.trim()} telah diproses. Dana akan masuk sesuai ketentuan bank (1-2 hari kerja).`, { type: 'withdrawal', route: '/profile' });
        await connection.commit();
    }
    catch (err) {
        await connection.rollback().catch(() => { });
        throw err;
    }
    finally {
        connection.release();
    }
    return {
        id: insertId,
        amount,
        fee,
        status: 'approved',
        bank_name: params.bank_name.trim(),
        account_number: params.account_number.trim(),
        account_name: params.account_name.trim(),
    };
}
/** Admin: daftar semua pengajuan (opsional filter status). */
async function adminListWithdrawals(status, limit = 50) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
        const [rows] = await database_js_1.default.query(`SELECT w.*, u.name AS mitra_name, m.store_name
       FROM withdrawal_requests w
       JOIN users u ON w.user_id = u.id
       JOIN mitra_profiles m ON w.mitra_id = m.id
       WHERE w.status = ?
       ORDER BY w.id DESC
       LIMIT ?`, [status, safeLimit]);
        return rows;
    }
    const [rows] = await database_js_1.default.query(`SELECT w.*, u.name AS mitra_name, m.store_name
     FROM withdrawal_requests w
     JOIN users u ON w.user_id = u.id
     JOIN mitra_profiles m ON w.mitra_id = m.id
     ORDER BY w.id DESC
     LIMIT ?`, [safeLimit]);
    return rows;
}
/** Admin: setujui / tolak pengajuan. Idempoten — status lama tidak dioverride. */
async function adminHandleWithdrawal(adminUserId, requestId, action, adminNote) {
    const [rows] = await database_js_1.default.query('SELECT * FROM withdrawal_requests WHERE id = ? LIMIT 1', [requestId]);
    if (!rows || rows.length === 0) {
        throw Object.assign(new Error('Pengajuan penarikan tidak ditemukan.'), { status: 404 });
    }
    const wr = rows[0];
    if (wr.status !== 'pending') {
        throw Object.assign(new Error(`Pengajuan ini sudah diproses (status: ${wr.status}).`), { status: 400 });
    }
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    await database_js_1.default.query(`UPDATE withdrawal_requests
     SET status = ?, admin_note = ?, processed_by = ?, processed_at = NOW()
     WHERE id = ?`, [newStatus, adminNote?.trim() || null, adminUserId, requestId]);
    const nominal = Number(wr.amount).toLocaleString('id-ID');
    const title = newStatus === 'approved' ? 'Penarikan Disetujui' : 'Penarikan Ditolak';
    const message = newStatus === 'approved'
        ? `Penarikan Rp ${nominal} telah disetujui dan akan ditransfer ke ${wr.bank_name} ${wr.account_number}.`
        : `Penarikan Rp ${nominal} ditolak.${adminNote ? ` Alasan: ${adminNote.trim()}` : ''} Saldo kembali tersedia.`;
    await database_js_1.default.query(`INSERT INTO notifications (user_id, title, message, type, reference_id)
     VALUES (?, ?, ?, 'withdrawal', ?)`, [wr.user_id, title, message, wr.id]);
    return { id: wr.id, status: newStatus, amount: Number(wr.amount) };
}
//# sourceMappingURL=walletService.js.map