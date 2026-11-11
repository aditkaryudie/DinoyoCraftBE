"use strict";
// ============================================================
//  src/controllers/paymentController.ts
//  Controller Pembayaran Midtrans Core API (PRD_Midtrans_Sandbox §5.2)
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.openSandboxSimulator = exports.simulatePayment = exports.handleWebhook = exports.cancelPayment = exports.checkOrderStatus = exports.createOrderPayment = exports.getMethods = void 0;
const midtransService_js_1 = require("../services/midtransService.js");
const paymentGatewayService_js_1 = require("../services/paymentGatewayService.js");
const orderSettlement_js_1 = require("../services/orderSettlement.js");
const response_js_1 = require("../utils/response.js");
/** GET /api/payments/methods — Daftar metode Midtrans aktif & konfigurasi biaya layanan. */
const getMethods = async (_req, res) => {
    (0, response_js_1.sendSuccess)(res, (0, paymentGatewayService_js_1.getPaymentMethodsPayload)(), 'Daftar metode pembayaran berhasil diambil.');
};
exports.getMethods = getMethods;
/** POST /api/payments/create — Buat atau ambil ulang tagihan Midtrans untuk satu order. */
const createOrderPayment = async (req, res) => {
    try {
        const userId = Number(res.locals['userId']);
        const role = String(res.locals['role'] || 'user');
        const orderId = Number(req.body?.order_id);
        const paymentMethod = String(req.body?.payment_method || 'qris').trim();
        if (!Number.isInteger(orderId) || orderId <= 0) {
            (0, response_js_1.sendBadRequest)(res, 'ID pesanan tidak valid.');
            return;
        }
        const result = await (0, paymentGatewayService_js_1.createOrUpdateCharge)(userId, role, orderId, paymentMethod);
        const host = req.get('host');
        if (typeof result['deeplink_url'] === 'string' &&
            result['deeplink_url'].startsWith('/') &&
            host) {
            const origin = `${req.protocol}://${host}`;
            result['deeplink_url'] = `${origin}${result['deeplink_url']}`;
            result['payment_url'] = result['deeplink_url'];
        }
        (0, response_js_1.sendSuccess)(res, result, result.reused
            ? 'Sesi pembayaran aktif berhasil dimuat ulang.'
            : 'Tagihan pembayaran Midtrans berhasil dibuat.');
    }
    catch (err) {
        const status = Number(err?.status || 500);
        if (status >= 500) {
            console.error('❌ [createOrderPayment] Error:', err);
        }
        (0, response_js_1.sendError)(res, err?.message || 'Gagal membuat transaksi pembayaran.', status);
    }
};
exports.createOrderPayment = createOrderPayment;
/** GET /api/payments/status/:orderId — Status pembayaran terkini (sinkron Midtrans bila pending). */
const checkOrderStatus = async (req, res) => {
    try {
        const userId = Number(res.locals['userId']);
        const role = String(res.locals['role'] || 'user');
        const orderId = Number(req.params['orderId']);
        if (!Number.isInteger(orderId) || orderId <= 0) {
            (0, response_js_1.sendBadRequest)(res, 'ID pesanan tidak valid.');
            return;
        }
        const result = await (0, paymentGatewayService_js_1.checkAndSyncOrderPayment)(userId, role, orderId);
        (0, response_js_1.sendSuccess)(res, result, 'Status pembayaran berhasil diperbarui.');
    }
    catch (err) {
        const status = Number(err?.status || 500);
        if (status >= 500) {
            console.error('❌ [checkOrderStatus] Error:', err);
        }
        (0, response_js_1.sendError)(res, err?.message || 'Gagal memeriksa status pembayaran.', status);
    }
};
exports.checkOrderStatus = checkOrderStatus;
/** POST /api/payments/cancel/:orderId — Batalkan tagihan Midtrans dan batalkan pesanan. */
const cancelPayment = async (req, res) => {
    try {
        const userId = Number(res.locals['userId']);
        const role = String(res.locals['role'] || 'user');
        const orderId = Number(req.params['orderId']);
        const reason = typeof req.body?.reason === 'string' && req.body.reason.trim()
            ? req.body.reason.trim()
            : 'Dibatalkan oleh pembeli';
        if (!Number.isInteger(orderId) || orderId <= 0) {
            (0, response_js_1.sendBadRequest)(res, 'ID pesanan tidak valid.');
            return;
        }
        const result = await (0, paymentGatewayService_js_1.cancelOrderPayment)(userId, role, orderId, reason);
        (0, response_js_1.sendSuccess)(res, result, 'Pembayaran dan pesanan berhasil dibatalkan.');
    }
    catch (err) {
        const status = Number(err?.status || 500);
        if (status >= 500) {
            console.error('❌ [cancelPayment] Error:', err);
        }
        (0, response_js_1.sendError)(res, err?.message || 'Gagal membatalkan pembayaran.', status);
    }
};
exports.cancelPayment = cancelPayment;
/** POST /api/payments/webhook — HTTP Notification dari Midtrans + verifikasi SHA512 signature_key. */
const handleWebhook = async (req, res) => {
    try {
        const { order_id: orderId, status_code: statusCode, gross_amount: grossAmount, signature_key: signatureKey, transaction_status: transactionStatus, fraud_status: fraudStatus, transaction_id: transactionId, } = req.body ?? {};
        if (!orderId || !statusCode || grossAmount === undefined || !signatureKey) {
            res.status(400).json({
                success: false,
                message: 'Payload notifikasi Midtrans tidak lengkap.',
            });
            return;
        }
        const validSignature = (0, midtransService_js_1.verifySignatureKey)(String(orderId), String(statusCode), String(grossAmount), String(signatureKey));
        if (!validSignature) {
            console.warn(`⚠️ [Midtrans Webhook] Signature tidak valid untuk order_id=${orderId}`);
            res.status(403).json({
                success: false,
                message: 'Signature notifikasi Midtrans tidak valid.',
            });
            return;
        }
        const trx = await (0, orderSettlement_js_1.findTransactionByRef)(String(orderId), transactionId ? String(transactionId) : undefined);
        if (!trx) {
            console.warn(`⚠️ [Midtrans Webhook] Transaksi tidak ditemukan untuk order_id=${orderId}`);
            // Balas 200 supaya Midtrans tidak retry terus (mis. test notification / orphan sandbox order)
            res.status(200).json({
                success: true,
                message: 'Notifikasi diterima (transaksi lokal tidak ditemukan).',
            });
            return;
        }
        const mappedStatus = await (0, paymentGatewayService_js_1.applyMidtransStatus)(trx, String(transactionStatus || ''), fraudStatus ? String(fraudStatus) : null, String(grossAmount), req.body);
        console.log(`📩 [Midtrans Webhook] order_id=${orderId} (${transactionStatus}) → ${mappedStatus}`);
        res.status(200).json({
            success: true,
            message: 'Notifikasi Midtrans berhasil diproses.',
            status: mappedStatus,
        });
    }
    catch (err) {
        const status = Number(err?.status || 500);
        console.error('❌ [Midtrans Webhook] Error:', err?.message || err);
        res.status(status).json({
            success: false,
            message: err?.message || 'Gagal memproses notifikasi Midtrans.',
        });
    }
};
exports.handleWebhook = handleWebhook;
/** POST /api/payments/simulate-paid/:orderId — Shortcut Sandbox only (otomatis mati di Production). */
const simulatePayment = async (req, res) => {
    try {
        const userId = Number(res.locals['userId']);
        const role = String(res.locals['role'] || 'user');
        const orderId = Number(req.params['orderId']);
        if (!Number.isInteger(orderId) || orderId <= 0) {
            (0, response_js_1.sendBadRequest)(res, 'ID pesanan tidak valid.');
            return;
        }
        const result = await (0, paymentGatewayService_js_1.simulateOrderPaid)(userId, role, orderId);
        (0, response_js_1.sendSuccess)(res, result, 'Simulasi pembayaran Sandbox berhasil ditandai lunas.');
    }
    catch (err) {
        const status = Number(err?.status || 500);
        if (status >= 500) {
            console.error('❌ [simulatePayment] Error:', err);
        }
        (0, response_js_1.sendError)(res, err?.message || 'Gagal menjalankan simulasi pembayaran.', status);
    }
};
exports.simulatePayment = simulatePayment;
/** GET /api/payments/sandbox-simulator/:orderId — Redirect auto-POST ke Midtrans Simulator Sandbox (VA/QRIS). */
const openSandboxSimulator = async (req, res) => {
    try {
        const orderId = Number(req.params['orderId']);
        const ref = String(req.query['ref'] || '').trim();
        const sig = String(req.query['sig'] || '').trim();
        if (!Number.isInteger(orderId) || orderId <= 0) {
            res.status(400).type('text/plain').send('ID pesanan tidak valid.');
            return;
        }
        const page = await (0, paymentGatewayService_js_1.getSandboxSimulatorPage)(orderId, ref, sig);
        if (page.redirectUrl) {
            res.redirect(page.redirectUrl);
            return;
        }
        // Izinkan form auto-submit lintas origin khusus menuju simulator Sandbox Midtrans
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; form-action https://simulator.sandbox.midtrans.com; style-src 'unsafe-inline'");
        res.status(page.status).type('html').send(page.html);
    }
    catch (err) {
        console.error('❌ [openSandboxSimulator] Error:', err);
        res.status(500).type('text/plain').send('Gagal membuka halaman simulator Midtrans.');
    }
};
exports.openSandboxSimulator = openSandboxSimulator;
//# sourceMappingURL=paymentController.js.map