"use strict";
// ============================================================
//  src/routes/paymentRoutes.ts
//  Router Payment Gateway (SociaBuzz via scbz sidecar)
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentController_js_1 = require("../controllers/paymentController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const validatorMiddleware_js_1 = require("../middlewares/validatorMiddleware.js");
const schemas_js_1 = require("../validators/schemas.js");
const router = (0, express_1.Router)();
// 1. Publik: Ambil daftar negara yang didukung
router.get('/countries', paymentController_js_1.getCountries);
// 2. Publik: Estimasi Fee / Biaya Transaksi
router.post('/fees', (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.paymentFeesSchema), paymentController_js_1.getFees);
// 3. Webhook (Callback dari background dispatcher scbz)
router.post('/webhook', paymentController_js_1.handleWebhook);
// ------------------------------------------------------------
// Rute di bawah ini wajib terautentikasi (Bearer Token JWT)
// ------------------------------------------------------------
router.use(authMiddleware_js_1.verifyToken);
// 4. Ambil metode pembayaran yang aktif untuk sesi
router.post('/methods', (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.paymentMethodsSchema), paymentController_js_1.getMethods);
// 5. Buat pembayaran untuk order (menghasilkan QRIS / URL)
router.post('/create', (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.createPaymentSchema), paymentController_js_1.createOrderPayment);
// 6. Cek status pembayaran secara real-time untuk order
router.get('/status/:orderId', paymentController_js_1.checkOrderStatus);
exports.default = router;
//# sourceMappingURL=paymentRoutes.js.map