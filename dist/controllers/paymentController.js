"use strict";
// ============================================================
//  src/controllers/paymentController.ts
//  Controller Payment Gateway (SociaBuzz via scbz sidecar)
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
exports.getPaymentStatus = exports.createPayment = exports.getPaymentMethods = exports.handleWebhook = exports.checkOrderStatus = exports.createOrderPayment = exports.getMethods = exports.getFees = exports.getCountries = void 0;
const crypto_1 = __importDefault(require("crypto"));
const database_js_1 = __importDefault(require("../config/database.js"));
const response_js_1 = require("../utils/response.js");
const paymentService = __importStar(require("../services/paymentService.js"));
const orderSettlement_js_1 = require("../services/orderSettlement.js");
// ------------------------------------------------------------
// 1. Ambil Daftar Negara yang Didukung Gateway
// ------------------------------------------------------------
const getCountries = async (_req, res) => {
    try {
        const data = await paymentService.getPaymentCountries();
        (0, response_js_1.sendSuccess)(res, data, 'Daftar negara berhasil diambil.');
    }
    catch (error) {
        (0, response_js_1.sendError)(res, error.message || 'Gagal mengambil daftar negara dari payment gateway.', error.status || 502);
    }
};
exports.getCountries = getCountries;
// ------------------------------------------------------------
// 2. Estimasi Biaya (Fee) Pembayaran
// ------------------------------------------------------------
const getFees = async (req, res) => {
    try {
        const { country = 'Indonesia', amount, username } = req.body;
        const data = await paymentService.calculatePaymentFees(country, Number(amount), username);
        (0, response_js_1.sendSuccess)(res, data, 'Estimasi biaya berhasil dihitung.');
    }
    catch (error) {
        (0, response_js_1.sendError)(res, error.message || 'Gagal menghitung biaya pembayaran.', error.status || 502);
    }
};
exports.getFees = getFees;
// ------------------------------------------------------------
// 3. Ambil Metode Pembayaran Berdasarkan Token Sesi
// ------------------------------------------------------------
const getMethods = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            (0, response_js_1.sendBadRequest)(res, 'Token sesi pembayaran wajib diisi.');
            return;
        }
        const data = await paymentService.fetchPaymentMethods(token);
        (0, response_js_1.sendSuccess)(res, data, 'Metode pembayaran tersedia berhasil diambil.');
    }
    catch (error) {
        (0, response_js_1.sendError)(res, error.message || 'Gagal mengambil metode pembayaran.', error.status || 502);
    }
};
exports.getMethods = getMethods;
// ------------------------------------------------------------
// 4. Buat Pembayaran untuk Pesanan (Order)
//    Menghasilkan QRIS / Link Pembayaran untuk Mobile App & Web
// ------------------------------------------------------------
const createOrderPayment = async (req, res) => {
    const connection = await database_js_1.default.getConnection();
    try {
        const userId = res.locals['userId'];
        const userRole = res.locals['role'];
        const { order_id, payment_method = 'qris' } = req.body;
        // 1. Ambil detail order, transaksi, dan user
        const [orders] = await connection.query(`SELECT o.id, o.user_id, o.total_amount, o.status AS order_status,
              t.id AS transaction_id, t.reference_code, t.status AS transaction_status,
              t.payment_token, t.inv_id, t.payment_url, t.qr_string,
              u.name AS user_name, u.email AS user_email
       FROM orders o
       JOIN transactions t ON o.transaction_id = t.id
       JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`, [order_id]);
        if (orders.length === 0) {
            (0, response_js_1.sendNotFound)(res, `Pesanan #${order_id} tidak ditemukan.`);
            return;
        }
        const order = orders[0];
        // 2. Otorisasi kepemilikan pesanan
        if (order.user_id !== userId && userRole !== 'admin') {
            (0, response_js_1.sendForbidden)(res, 'Anda tidak berhak membuat pembayaran untuk pesanan ini.');
            return;
        }
        // 3. Validasi status
        if (order.order_status === 'paid' || order.transaction_status === 'success') {
            (0, response_js_1.sendBadRequest)(res, 'Pesanan ini sudah dibayar.');
            return;
        }
        if (order.order_status === 'cancelled') {
            (0, response_js_1.sendBadRequest)(res, 'Pesanan ini telah dibatalkan.');
            return;
        }
        // 4. Siapkan URL Webhook untuk callback dari gateway scbz
        const host = req.get('host') || '127.0.0.1:5000';
        const protocol = req.protocol || 'http';
        const callbackUrl = `${protocol}://${host}/api/payments/webhook`;
        // 5. Hitung Biaya Layanan agar nominal di SociaBuzz menutup potongan fee & biaya penarikan
        const baseOrderAmount = Number(order.total_amount);
        const serviceFeeCalc = paymentService.calculateServiceFee(baseOrderAmount);
        const totalAmountToCharge = serviceFeeCalc.finalAmountToPay;
        // 6. Buat pembayaran (Native 100% Vercel dengan fallback)
        let paymentResult;
        try {
            paymentResult = await paymentService.processDirectPayment({
                amount: totalAmountToCharge,
                fullname: order.user_name,
                email: order.user_email,
                note: `Order #${order.id} - ${order.reference_code}`,
                paymentMethod: payment_method,
            });
        }
        catch (directErr) {
            console.warn('⚠️ [processDirectPayment] Fallback ke createDonationSession:', directErr.message);
            const session = await paymentService.createDonationSession({
                amount: totalAmountToCharge,
                fullname: order.user_name,
                email: order.user_email,
                note: `Order #${order.id} - ${order.reference_code}`,
                callback_url: callbackUrl,
            });
            paymentResult = await paymentService.initiatePayment(session.token, payment_method);
        }
        const sessionToken = paymentResult.token;
        // 7. Simpan token, inv_id, qr_string, dan url pembayaran ke transaksi di database
        await connection.query(`UPDATE transactions SET
         transaction_type = ?,
         payment_token = ?,
         inv_id = ?,
         payment_url = ?,
         qr_string = ?,
         gateway_fee = ?
       WHERE id = ?`, [
            paymentResult.payment_method || payment_method,
            sessionToken,
            paymentResult.inv_id || null,
            paymentResult.payment_url || null,
            paymentResult.qr_string || null,
            serviceFeeCalc.totalServiceFee,
            order.transaction_id,
        ]);
        (0, response_js_1.sendSuccess)(res, {
            order_id: order.id,
            transaction_id: order.transaction_id,
            reference_code: order.reference_code,
            payment_method: paymentResult.payment_method || payment_method,
            label: paymentResult.label || 'Pembayaran',
            base_amount: baseOrderAmount,
            service_fee: serviceFeeCalc.totalServiceFee,
            service_fee_details: {
                fixed: serviceFeeCalc.fixedFee,
                percent: serviceFeeCalc.percentFee,
            },
            amount: totalAmountToCharge,
            fee: paymentResult.fee,
            total_pay: totalAmountToCharge,
            payment_url: paymentResult.payment_url || null,
            qr_string: paymentResult.qr_string || null,
            token: sessionToken,
            inv_id: paymentResult.inv_id || null,
            payment_status: 'pending',
        }, 'Instruksi pembayaran berhasil dibuat.');
    }
    catch (error) {
        console.error('❌ [createOrderPayment] Error:', error);
        (0, response_js_1.sendError)(res, error.message || 'Gagal membuat pembayaran.', error.status || 500);
    }
    finally {
        connection.release();
    }
};
exports.createOrderPayment = createOrderPayment;
// ------------------------------------------------------------
// 5. Cek Status Pembayaran Pesanan (Polling dari Mobile/Frontend)
// ------------------------------------------------------------
const checkOrderStatus = async (req, res) => {
    const connection = await database_js_1.default.getConnection();
    try {
        const userId = res.locals['userId'];
        const userRole = res.locals['role'];
        const orderId = Number(req.params['orderId']);
        if (!orderId || isNaN(orderId)) {
            (0, response_js_1.sendBadRequest)(res, 'ID pesanan tidak valid.');
            return;
        }
        const [orders] = await connection.query(`SELECT o.id, o.user_id, o.mitra_id, o.status AS order_status, o.total_amount,
              t.id AS transaction_id, t.transaction_type, t.reference_code,
              t.status AS transaction_status, t.payment_token, t.inv_id,
              t.payment_url, t.qr_string,
              m.user_id AS mitra_user_id, m.store_name
       FROM orders o
       JOIN transactions t ON o.transaction_id = t.id
       JOIN mitra_profiles m ON o.mitra_id = m.id
       WHERE o.id = ?`, [orderId]);
        if (orders.length === 0) {
            (0, response_js_1.sendNotFound)(res, `Pesanan #${orderId} tidak ditemukan.`);
            return;
        }
        const order = orders[0];
        // Otorisasi: pemilik pesanan, mitra terkait, atau admin
        if (order.user_id !== userId && order.mitra_user_id !== userId && userRole !== 'admin') {
            (0, response_js_1.sendForbidden)(res, 'Anda tidak berhak melihat status pembayaran pesanan ini.');
            return;
        }
        // Jika sudah lunas di DB, langsung kembalikan 'paid'
        if (order.order_status === 'paid' || order.transaction_status === 'success') {
            (0, response_js_1.sendSuccess)(res, {
                order_id: order.id,
                transaction_status: 'success',
                order_status: 'paid',
                payment_status: 'paid',
            });
            return;
        }
        // Jika ada token dan inv_id, tanyakan ke gateway scbz secara real-time
        let liveStatus = 'pending';
        if (order.payment_token && order.transaction_type) {
            try {
                const checkResult = await paymentService.verifyPaymentStatus(order.payment_token, order.transaction_type, order.inv_id || order.payment_token);
                liveStatus = checkResult.status || 'pending';
            }
            catch (err) {
                console.warn('⚠️ [checkOrderStatus] Gagal menghubungi scbz:', err.message);
            }
        }
        // Jika scbz melaporkan status 'paid', perbarui database secara otomatis
        if (liveStatus === 'paid' && order.order_status !== 'paid') {
            await (0, orderSettlement_js_1.settleOrderPaid)({
                id: order.transaction_id,
                order_id: order.id,
                user_id: order.user_id,
                mitra_user_id: order.mitra_user_id,
                total_amount: order.total_amount,
            });
            (0, response_js_1.sendSuccess)(res, {
                order_id: order.id,
                transaction_status: 'success',
                order_status: 'paid',
                payment_status: 'paid',
            }, 'Pembayaran telah terverifikasi lunas!');
            return;
        }
        (0, response_js_1.sendSuccess)(res, {
            order_id: order.id,
            transaction_status: order.transaction_status,
            order_status: order.order_status,
            payment_status: liveStatus,
        });
    }
    catch (error) {
        await connection.rollback().catch(() => { });
        console.error('❌ [checkOrderStatus] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal memeriksa status pembayaran.');
    }
    finally {
        connection.release();
    }
};
exports.checkOrderStatus = checkOrderStatus;
// ------------------------------------------------------------
// 6. Webhook Callback Endpoint (Dipanggil oleh scbz dispatcher)
// ------------------------------------------------------------
const handleWebhook = async (req, res) => {
    const connection = await database_js_1.default.getConnection();
    try {
        const webhookSecret = process.env['WEBHOOK_SECRET'];
        if (webhookSecret) {
            const incomingSecret = req.headers['x-webhook-secret'];
            const incomingSignature = req.headers['x-webhook-signature'];
            if (incomingSecret && incomingSecret !== webhookSecret) {
                (0, response_js_1.sendForbidden)(res, 'Webhook secret tidak valid.');
                return;
            }
            if (incomingSignature) {
                const rawBody = JSON.stringify(req.body);
                const expectedSig = crypto_1.default
                    .createHmac('sha256', webhookSecret)
                    .update(rawBody)
                    .digest('hex');
                if (incomingSignature !== expectedSig) {
                    (0, response_js_1.sendForbidden)(res, 'Webhook signature tidak valid.');
                    return;
                }
            }
        }
        const { event, token, inv_id, status } = req.body;
        console.log(`🔔 [Webhook Payment] Diterima: event=${event}, token=${token}, inv_id=${inv_id}, status=${status}`);
        if (status === 'paid' || event === 'payment.paid') {
            // Temukan transaksi berdasarkan token atau inv_id, lalu tandai lunas
            // (idempoten — aman dipanggil ulang).
            const trx = await (0, orderSettlement_js_1.findTransactionByRef)(inv_id, token);
            if (trx) {
                const settled = await (0, orderSettlement_js_1.settleOrderPaid)(trx);
                if (settled) {
                    console.log(`✅ [Webhook Payment] Pesanan #${trx.order_id} ditandai 'paid'.`);
                }
            }
        }
        (0, response_js_1.sendSuccess)(res, { received: true }, 'Webhook berhasil diproses.');
    }
    catch (error) {
        await connection.rollback().catch(() => { });
        console.error('❌ [handleWebhook] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal memproses webhook pembayaran.');
    }
    finally {
        connection.release();
    }
};
exports.handleWebhook = handleWebhook;
// Aliases agar kompatibel dengan pemanggilan fungsi versi alternatif
exports.getPaymentMethods = exports.getMethods;
exports.createPayment = exports.createOrderPayment;
exports.getPaymentStatus = exports.checkOrderStatus;
//# sourceMappingURL=paymentController.js.map