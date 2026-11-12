"use strict";
// ============================================================
//  src/routes/index.ts
//  Central Router — mendaftarkan semua router modular
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authRoutes_js_1 = __importDefault(require("./authRoutes.js"));
const userRoutes_js_1 = __importDefault(require("./userRoutes.js"));
const adminRoutes_js_1 = __importDefault(require("./adminRoutes.js"));
const aiRoutes_js_1 = __importDefault(require("./aiRoutes.js"));
const productRoutes_js_1 = __importDefault(require("./productRoutes.js"));
const mitraRoutes_js_1 = __importDefault(require("./mitraRoutes.js"));
const chatRoutes_js_1 = __importDefault(require("./chatRoutes.js"));
const moderationRoutes_js_1 = __importDefault(require("./moderationRoutes.js"));
const addressRoutes_js_1 = __importDefault(require("./addressRoutes.js"));
const cartRoutes_js_1 = __importDefault(require("./cartRoutes.js"));
const orderRoutes_js_1 = __importDefault(require("./orderRoutes.js"));
const paymentRoutes_js_1 = __importDefault(require("./paymentRoutes.js"));
const reviewRoutes_js_1 = __importDefault(require("./reviewRoutes.js"));
const notificationRoutes_js_1 = __importDefault(require("./notificationRoutes.js"));
const systemLogController_js_1 = require("../controllers/systemLogController.js");
const router = (0, express_1.Router)();
router.use('/auth', authRoutes_js_1.default);
router.use('/user', userRoutes_js_1.default);
router.use('/admin', adminRoutes_js_1.default);
router.use('/admin/moderation', moderationRoutes_js_1.default);
router.use('/moderation', moderationRoutes_js_1.default);
router.use('/ai', aiRoutes_js_1.default);
router.use('/products', productRoutes_js_1.default);
router.use('/mitra', mitraRoutes_js_1.default);
router.use('/chat', chatRoutes_js_1.default);
// Rute Fungsional E-Commerce
router.use('/addresses', addressRoutes_js_1.default);
router.use('/cart', cartRoutes_js_1.default);
router.use('/carts', cartRoutes_js_1.default);
router.use('/orders', orderRoutes_js_1.default);
router.use('/payments', paymentRoutes_js_1.default);
router.use('/reviews', reviewRoutes_js_1.default);
router.use('/notifications', notificationRoutes_js_1.default);
// Endpoint Ingest Telemetry Aman (Mobile Flutter & Web Frontend) (§10.3, §10.4, §11)
router.post('/internal/logs/mobile', systemLogController_js_1.ingestClientLog);
router.post('/internal/logs/web', systemLogController_js_1.ingestClientLog);
exports.default = router;
//# sourceMappingURL=index.js.map