"use strict";
// ============================================================
//  src/routes/paymentRoutes.ts
//  Router Pembayaran Midtrans Sandbox (PRD_Midtrans_Sandbox §5.2)
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentController_js_1 = require("../controllers/paymentController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const validatorMiddleware_js_1 = require("../middlewares/validatorMiddleware.js");
const schemas_js_1 = require("../validators/schemas.js");
const router = (0, express_1.Router)();
// Publik: daftar metode & biaya layanan aktif dari konfigurasi env
router.get('/methods', paymentController_js_1.getMethods);
// Publik + verifikasi SHA512 signature_key dari Midtrans
router.post('/webhook', paymentController_js_1.handleWebhook);
// Publik Sandbox only + verifikasi HMAC signature (untuk redirect external browser VA/QRIS)
router.get('/sandbox-simulator/:orderId', paymentController_js_1.openSandboxSimulator);
// Terproteksi JWT: buat/ambil charge, cek status, batal, dan shortcut sandbox
router.post('/create', authMiddleware_js_1.verifyToken, (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.createPaymentSchema), paymentController_js_1.createOrderPayment);
router.get('/status/:orderId', authMiddleware_js_1.verifyToken, paymentController_js_1.checkOrderStatus);
router.post('/cancel/:orderId', authMiddleware_js_1.verifyToken, paymentController_js_1.cancelPayment);
router.post('/simulate-paid/:orderId', authMiddleware_js_1.verifyToken, paymentController_js_1.simulatePayment);
exports.default = router;
//# sourceMappingURL=paymentRoutes.js.map