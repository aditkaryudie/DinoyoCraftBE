"use strict";
// ============================================================
//  src/services/paymentPoller.ts
//  Background Poller Pembayaran — pengganti WebhookDispatcher Go (scbz).
//  Scan transaksi pending setiap POLL_INTERVAL detik, cek status ke
//  SociaBuzz, dan otomatis menandai pesanan lunas bila terbayar.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPaymentPoller = startPaymentPoller;
const database_js_1 = __importDefault(require("../config/database.js"));
const paymentService = __importStar(require("./paymentService.js"));
const orderSettlement_js_1 = require("./orderSettlement.js");
const POLL_INTERVAL_MS = Number(process.env['PAYMENT_POLL_INTERVAL_MS'] || 30_000);
const MAX_AGE_HOURS = Number(process.env['PAYMENT_POLL_MAX_AGE_HOURS'] || 24);
const inFlight = new Set();
let timer = null;
async function pollOnce() {
    try {
        // Ambil transaksi pending yang sudah punya token pembayaran.
        const [rows] = await database_js_1.default.query(`SELECT t.id, o.id AS order_id, o.user_id, o.total_amount,
              t.payment_token, t.inv_id, t.transaction_type,
              m.user_id AS mitra_user_id
       FROM transactions t
       JOIN orders o ON o.transaction_id = t.id
       JOIN mitra_profiles m ON o.mitra_id = m.id
       WHERE t.status = 'pending'
         AND t.payment_token IS NOT NULL
         AND t.created_at > NOW() - INTERVAL ? HOUR
       ORDER BY t.id ASC
       LIMIT 25`, [MAX_AGE_HOURS]);
        for (const row of rows) {
            if (inFlight.has(row.id))
                continue;
            inFlight.add(row.id);
            // Fire-and-forget per transaksi agar satu cek lambat tidak menahan lainnya.
            void (async () => {
                try {
                    const result = await paymentService.verifyPaymentStatus(row.payment_token, row.transaction_type || 'qris', row.inv_id || row.payment_token);
                    if (result.status === 'paid') {
                        await (0, orderSettlement_js_1.settleOrderPaid)({
                            id: row.id,
                            order_id: row.order_id,
                            user_id: row.user_id,
                            mitra_user_id: row.mitra_user_id,
                            total_amount: row.total_amount,
                        });
                    }
                }
                catch (err) {
                    console.warn('⚠️ [paymentPoller] Gagal cek transaksi #' + row.id + ':', err.message);
                }
                finally {
                    inFlight.delete(row.id);
                }
            })();
        }
    }
    catch (err) {
        console.warn('⚠️ [paymentPoller] Gagal scan transaksi pending:', err.message);
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
    console.log(`🔄 [paymentPoller] Aktif — memeriksa pembayaran pending tiap ${POLL_INTERVAL_MS / 1000}s`);
}
//# sourceMappingURL=paymentPoller.js.map