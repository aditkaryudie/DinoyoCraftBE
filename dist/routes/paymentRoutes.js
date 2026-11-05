"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentController_js_1 = require("../controllers/paymentController.js");
const router = (0, express_1.Router)();
// Karena di src/routes/index.ts sudah dipasang router.use('/payments', paymentRoutes),
// maka rute berikut akan langsung menjadi /api/payments/create-snap dan /api/payments/webhook
router.post('/create-snap', paymentController_js_1.createMidtransTransaction);
router.post('/webhook', paymentController_js_1.handleMidtransNotification);
// Alias untuk fleksibilitas jika diakses dengan path /payments/...
router.post('/payments/create-snap', paymentController_js_1.createMidtransTransaction);
router.post('/payments/webhook', paymentController_js_1.handleMidtransNotification);
exports.default = router;
//# sourceMappingURL=paymentRoutes.js.map