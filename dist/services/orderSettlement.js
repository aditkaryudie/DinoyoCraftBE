"use strict";
// ============================================================
//  src/services/orderSettlement.ts
//  Penyelesaian pesanan: menandai pesanan LUNAS secara idempoten.
//  Dipakai bersama oleh: webhook scbz, polling mobile, dan background poller
//  (pengganti webhook dispatcher Go pada sidecar lama).
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.settleOrderPaid = settleOrderPaid;
exports.findTransactionByRef = findTransactionByRef;
const database_js_1 = __importDefault(require("../config/database.js"));
const notificationService_js_1 = require("./notificationService.js");
const pusher_js_1 = __importDefault(require("../utils/pusher.js"));
/**
 * Tandai transaksi + pesanan sebagai 'paid'/'success', kirim notifikasi ke
 * mitra & pembeli, dan trigger Pusher. Idempoten: jika transaksi sudah
 * 'success', tidak melakukan apa-apa dan mengembalikan false.
 */
async function settleOrderPaid(trx) {
    const connection = await database_js_1.default.getConnection();
    try {
        // Idempotency guard — cek ulang di dalam lock transaksi.
        const [current] = await connection.query('SELECT status FROM transactions WHERE id = ? FOR UPDATE', [trx.id]);
        if (!current || current.length === 0 || current[0].status === 'success') {
            return false;
        }
        await connection.beginTransaction();
        await connection.query("UPDATE transactions SET status = 'success' WHERE id = ?", [
            trx.id,
        ]);
        await connection.query("UPDATE orders SET status = 'paid' WHERE id = ?", [
            trx.order_id,
        ]);
        // Timeline tracking: pembayaran terverifikasi
        await connection.query('INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)', [trx.order_id, 'paid', 'Pembayaran terverifikasi']);
        const nominal = Number(trx.total_amount || 0).toLocaleString('id-ID');
        await connection.query(`INSERT INTO notifications (user_id, title, message, type, reference_id)
       VALUES (?, ?, ?, 'order', ?)`, [
            trx.mitra_user_id,
            'Pembayaran Diterima!',
            `Pesanan #${trx.order_id} telah dibayar lunas sebesar Rp ${nominal}. Segera proses pesanan ini.`,
            trx.order_id,
        ]);
        await connection.query(`INSERT INTO notifications (user_id, title, message, type, reference_id)
       VALUES (?, ?, ?, 'order', ?)`, [
            trx.user_id,
            'Pembayaran Berhasil',
            `Pembayaran pesanan #${trx.order_id} telah berhasil dikonfirmasi. Penjual akan segera memproses barang Anda.`,
            trx.order_id,
        ]);
        await connection.commit();
        try {
            await pusher_js_1.default.trigger(`user-${trx.user_id}`, 'order-paid', {
                order_id: trx.order_id,
                status: 'paid',
            });
            await pusher_js_1.default.trigger(`user-${trx.mitra_user_id}`, 'new-paid-order', {
                order_id: trx.order_id,
                status: 'paid',
            });
        }
        catch {
            // Pusher gagal — non-blocking.
        }
        // Push FCM ke perangkat mitra & pembeli (non-blocking).
        void (0, notificationService_js_1.sendPushNotificationToUser)(trx.mitra_user_id, 'Pembayaran Diterima!', `Pesanan #${trx.order_id} telah dibayar lunas sebesar Rp ${Number(trx.total_amount || 0).toLocaleString('id-ID')}. Segera proses pesanan ini.`, { type: 'order', route: '/profile', order_id: String(trx.order_id) });
        void (0, notificationService_js_1.sendPushNotificationToUser)(trx.user_id, 'Pembayaran Berhasil', `Pembayaran pesanan #${trx.order_id} telah berhasil dikonfirmasi. Penjual akan segera memproses barang Anda.`, { type: 'order', route: '/profile', order_id: String(trx.order_id) });
        console.log(`✅ [settleOrderPaid] Pesanan #${trx.order_id} ditandai LUNAS.`);
        return true;
    }
    catch (error) {
        await connection.rollback().catch(() => { });
        throw error;
    }
    finally {
        connection.release();
    }
}
/**
 * Cari transaksi berdasarkan inv_id atau payment_token (dipakai webhook).
 */
async function findTransactionByRef(invId, token) {
    const [rows] = await database_js_1.default.query(`SELECT t.id, o.id AS order_id, o.user_id, o.mitra_id, o.total_amount,
            t.status, m.user_id AS mitra_user_id
     FROM transactions t
     JOIN orders o ON o.transaction_id = t.id
     JOIN mitra_profiles m ON o.mitra_id = m.id
     WHERE t.inv_id = ? OR t.payment_token = ?
     LIMIT 1`, [invId || '', token || '']);
    if (!rows || rows.length === 0)
        return null;
    const r = rows[0];
    return {
        id: r.id,
        order_id: r.order_id,
        user_id: r.user_id,
        mitra_user_id: r.mitra_user_id,
        total_amount: r.total_amount,
        status: r.status,
    };
}
//# sourceMappingURL=orderSettlement.js.map