"use strict";
// ============================================================
//  src/services/orderExpiry.ts
//  Pembatalan / Kedaluwarsa Pesanan Otomatis (PRD_Midtrans_Sandbox §5.3).
//  Mengembalikan stok, menandai transaksi & order, catat riwayat,
//  dan kirim notifikasi DB + Pusher + FCM secara idempoten.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelOrExpireOrderPayment = cancelOrExpireOrderPayment;
exports.expireOrder = expireOrder;
const database_js_1 = __importDefault(require("../config/database.js"));
const notificationService_js_1 = require("./notificationService.js");
const pusher_js_1 = __importDefault(require("../utils/pusher.js"));
const productController_js_1 = require("../controllers/productController.js");
/**
 * Tandai transaksi pending sebagai gagal/expired/dibatalkan secara idempoten:
 * stok dikembalikan, order diubah ke 'cancelled', timeline & notifikasi dicatat.
 *
 * Catatan ENUM DB: kolom `transactions.status` hanya menerima
 * ('pending','success','failed','cancelled'), sehingga `expired` disimpan sebagai
 * `failed` dan detail `internal_reason: 'expired'` ikut dicatat pada `gateway_response`.
 */
async function cancelOrExpireOrderPayment(trx, reasonStatus, raw) {
    const connection = await database_js_1.default.getConnection();
    try {
        await connection.beginTransaction();
        const [current] = await connection.query('SELECT status FROM transactions WHERE id = ? FOR UPDATE', [trx.id]);
        if (!current?.length || current[0].status !== 'pending') {
            await connection.rollback();
            return false;
        }
        const dbTxStatus = reasonStatus === 'cancelled' ? 'cancelled' : 'failed';
        const historyNote = {
            expired: 'Pesanan kedaluwarsa — tidak dibayar sebelum batas waktu',
            failed: 'Pembayaran gagal atau ditolak oleh gateway',
            cancelled: 'Pembayaran dibatalkan',
        };
        // Kembalikan stok produk
        const [items] = await connection.query('SELECT product_id, quantity, variant FROM order_items WHERE order_id = ?', [trx.order_id]);
        for (const it of items) {
            await (0, productController_js_1.adjustProductStockAndVariant)(connection, it.product_id, it.quantity, it.variant);
        }
        const storedRaw = raw && typeof raw === 'object' && !Array.isArray(raw)
            ? { ...raw, internal_reason: reasonStatus }
            : { raw: raw ?? null, internal_reason: reasonStatus };
        await connection.query('UPDATE transactions SET status = ?, gateway_response = ? WHERE id = ?', [dbTxStatus, JSON.stringify(storedRaw), trx.id]);
        await connection.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [
            trx.order_id,
        ]);
        await connection.query("INSERT INTO order_status_history (order_id, status, note) VALUES (?, 'cancelled', ?)", [trx.order_id, historyNote[reasonStatus]]);
        const nominal = Number(trx.total_amount || 0).toLocaleString('id-ID');
        const buyerTitle = reasonStatus === 'expired'
            ? 'Pesanan Kedaluwarsa'
            : reasonStatus === 'cancelled'
                ? 'Pembayaran Dibatalkan'
                : 'Pembayaran Gagal';
        await connection.query(`INSERT INTO notifications (user_id, title, message, type, reference_id)
       VALUES (?, ?, ?, 'order', ?)`, [
            trx.user_id,
            buyerTitle,
            `Pesanan #${trx.order_id} (Rp ${nominal}) dibatalkan otomatis. ${historyNote[reasonStatus]}. Silakan buat pesanan baru bila masih berminat.`,
            trx.order_id,
        ]);
        await connection.query(`INSERT INTO notifications (user_id, title, message, type, reference_id)
       VALUES (?, ?, ?, 'order', ?)`, [
            trx.mitra_user_id,
            'Pesanan Dibatalkan Otomatis',
            `Pesanan #${trx.order_id} dibatalkan otomatis (${reasonStatus === 'expired' ? 'kedaluwarsa' : historyNote[reasonStatus]}).`,
            trx.order_id,
        ]);
        await connection.commit();
        try {
            await pusher_js_1.default.trigger(`user-${trx.user_id}`, 'order-status-changed', {
                order_id: trx.order_id,
                status: 'cancelled',
                payment_status: reasonStatus,
            });
            await pusher_js_1.default.trigger(`user-${trx.mitra_user_id}`, 'order-status-changed', {
                order_id: trx.order_id,
                status: 'cancelled',
                payment_status: reasonStatus,
            });
        }
        catch {
            // Non-blocking
        }
        void (0, notificationService_js_1.sendPushNotificationToUser)(trx.user_id, buyerTitle, `Pesanan #${trx.order_id} dibatalkan otomatis. Silakan buat pesanan baru bila masih berminat.`, { type: 'order', route: '/profile', order_id: String(trx.order_id), status: 'cancelled' });
        return true;
    }
    catch (err) {
        await connection.rollback().catch(() => { });
        throw err;
    }
    finally {
        connection.release();
    }
}
/** Shortcut khusus untuk pesanan yang melewati batas waktu pembayaran. */
async function expireOrder(trx, raw) {
    return cancelOrExpireOrderPayment(trx, 'expired', raw ?? { reason: 'expired' });
}
//# sourceMappingURL=orderExpiry.js.map