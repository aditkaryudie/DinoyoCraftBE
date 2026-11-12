"use strict";
// ============================================================
//  src/services/paymentPoller.ts
//  Background Poller Pembayaran Midtrans (PRD_Midtrans_Sandbox §5.3).
//  Scan transaksi pending setiap POLL_INTERVAL detik, cek status ke
//  Midtrans Core API, dan otomatis membatalkan/expire bila lewat waktu.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPaymentPoller = startPaymentPoller;
const database_js_1 = __importDefault(require("../config/database.js"));
const midtransService_js_1 = require("./midtransService.js");
const paymentGatewayService_js_1 = require("./paymentGatewayService.js");
const orderExpiry_js_1 = require("./orderExpiry.js");
const loggingService_js_1 = require("./loggingService.js");
const POLL_INTERVAL_MS = Number(process.env['PAYMENT_POLL_INTERVAL_MS'] || 30_000);
const MAX_AGE_HOURS = Number(process.env['PAYMENT_POLL_MAX_AGE_HOURS'] || 24);
const inFlight = new Set();
let timer = null;
let loggedMissingKeys = false;
async function pollOnce() {
    try {
        // Ambil transaksi Midtrans pending yang masih dalam rentang MAX_AGE_HOURS
        // atau sudah melewati expiry_time lokal agar tetap bisa dibatalkan otomatis.
        const [rows] = await database_js_1.default.query(`SELECT t.id, o.id AS order_id, o.user_id, o.total_amount,
              t.gateway_order_id, t.gateway_fee, t.expiry_time, t.status,
              m.user_id AS mitra_user_id
       FROM transactions t
       JOIN orders o ON o.transaction_id = t.id
       JOIN mitra_profiles m ON o.mitra_id = m.id
       WHERE t.status = 'pending'
         AND o.status = 'pending'
         AND t.gateway = 'midtrans'
         AND (
           (t.gateway_order_id IS NOT NULL AND t.created_at > NOW() - INTERVAL ? HOUR)
           OR (t.expiry_time IS NOT NULL AND t.expiry_time <= NOW())
         )
       ORDER BY t.id ASC
       LIMIT 25`, [MAX_AGE_HOURS]);
        if (!rows || rows.length === 0)
            return;
        if (!(0, midtransService_js_1.getIsMidtransConfigured)() && !loggedMissingKeys) {
            loggedMissingKeys = true;
            console.warn('⚠️ [paymentPoller] MIDTRANS_SERVER_KEY / MIDTRANS_CLIENT_KEY belum diisi; sinkronisasi remote Midtrans dilewati sampai .env dilengkapi.');
        }
        for (const row of rows) {
            if (inFlight.has(row.id))
                continue;
            inFlight.add(row.id);
            void (async () => {
                try {
                    let currentStatus = 'pending';
                    if (row.gateway_order_id && (0, midtransService_js_1.getIsMidtransConfigured)()) {
                        currentStatus = await (0, paymentGatewayService_js_1.syncStatusFromMidtrans)({
                            id: row.id,
                            order_id: row.order_id,
                            user_id: row.user_id,
                            mitra_user_id: row.mitra_user_id,
                            total_amount: Number(row.total_amount || 0),
                            gateway_fee: Number(row.gateway_fee || 0),
                            status: row.status,
                            gateway_order_id: row.gateway_order_id,
                        });
                    }
                    if (currentStatus === 'pending') {
                        const expiryDate = (0, paymentGatewayService_js_1.parseGatewayDate)(row.expiry_time);
                        if (expiryDate && expiryDate.getTime() <= Date.now()) {
                            if (row.gateway_order_id && (0, midtransService_js_1.getIsMidtransConfigured)()) {
                                await (0, paymentGatewayService_js_1.cancelRemoteChargeIfAny)(row.gateway_order_id);
                            }
                            await (0, orderExpiry_js_1.expireOrder)({
                                id: row.id,
                                order_id: row.order_id,
                                user_id: row.user_id,
                                mitra_user_id: row.mitra_user_id,
                                total_amount: Number(row.total_amount || 0),
                            });
                            (0, loggingService_js_1.logSystemEvent)({
                                category: 'transaction',
                                eventName: 'transaction.poller.order_expired',
                                severity: 'warning',
                                outcome: 'info',
                                message: `Transaksi #${row.id} (Order #${row.order_id}) otomatis kedaluwarsa karena melewati batas waktu pembayaran`,
                                source: 'worker',
                                service: 'payment-poller',
                                correlation: {
                                    userId: row.user_id ? Number(row.user_id) : null,
                                    orderId: row.order_id ? Number(row.order_id) : null,
                                    transactionId: Number(row.id),
                                    referenceCode: row.gateway_order_id || null,
                                },
                            }).catch(() => { });
                        }
                    }
                }
                catch (err) {
                    console.warn('⚠️ [paymentPoller] Gagal cek transaksi #' + row.id + ':', err?.message || err);
                    (0, loggingService_js_1.logSystemEvent)({
                        category: 'transaction',
                        eventName: 'transaction.poller.sync_failed',
                        severity: 'error',
                        outcome: 'failure',
                        message: `Payment poller gagal sinkronisasi transaksi #${row.id}: ${err?.message || 'Unknown error'}`,
                        source: 'worker',
                        service: 'payment-poller',
                        correlation: {
                            userId: row.user_id ? Number(row.user_id) : null,
                            orderId: row.order_id ? Number(row.order_id) : null,
                            transactionId: Number(row.id),
                            referenceCode: row.gateway_order_id || null,
                        },
                        error: {
                            code: 'POLLER_SYNC_ERR',
                            name: err?.name || 'PollerError',
                            message: err?.message || String(err),
                            stack: err?.stack || null,
                        },
                    }).catch(() => { });
                }
                finally {
                    inFlight.delete(row.id);
                }
            })();
        }
    }
    catch (err) {
        console.warn('⚠️ [paymentPoller] Gagal scan transaksi pending:', err?.message || err);
    }
}
/** Jalankan poller di background (sekali saja per proses). */
function startPaymentPoller() {
    if (timer)
        return;
    if (process.env['PAYMENT_POLLER_ENABLED'] === 'false') {
        console.log('⏸️ [paymentPoller] Dimatikan via PAYMENT_POLLER_ENABLED=false');
        return;
    }
    // Cek pertama setelah 10 detik server siap, lalu berkala.
    setTimeout(() => void pollOnce(), 10_000).unref?.();
    timer = setInterval(() => void pollOnce(), POLL_INTERVAL_MS);
    timer.unref?.();
    console.log(`🔄 [paymentPoller] Midtrans poller aktif — memeriksa pembayaran pending tiap ${POLL_INTERVAL_MS / 1000}s`);
}
//# sourceMappingURL=paymentPoller.js.map