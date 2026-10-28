"use strict";
// ============================================================
//  src/routes/orderRoutes.ts
//  Router Transaksi & Pesanan
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orderController_js_1 = require("../controllers/orderController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const validatorMiddleware_js_1 = require("../middlewares/validatorMiddleware.js");
const schemas_js_1 = require("../validators/schemas.js");
const router = (0, express_1.Router)();
// Semua rute pesanan wajib login
router.use(authMiddleware_js_1.verifyToken);
// Customer Checkout & History
router.post('/checkout', (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.checkoutOrderSchema), orderController_js_1.checkout);
router.get('/', orderController_js_1.getUserOrders);
// Toko Mitra: Ambil pesanan yang masuk ke tokonya
router.get('/mitra', (0, authMiddleware_js_1.requireRole)(['mitra', 'admin']), orderController_js_1.getMitraOrders);
// Detail Pesanan & Update Status
router.get('/:id', orderController_js_1.getOrderById);
router.patch('/:id/status', (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.updateOrderStatusSchema), orderController_js_1.updateOrderStatus);
exports.default = router;
//# sourceMappingURL=orderRoutes.js.map