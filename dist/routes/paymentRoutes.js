"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentController_js_1 = require("../controllers/paymentController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const router = (0, express_1.Router)();
router.use(authMiddleware_js_1.verifyToken);
router.post('/methods', paymentController_js_1.getPaymentMethods);
router.post('/create', paymentController_js_1.createPayment);
router.get('/status/:orderId', paymentController_js_1.getPaymentStatus);
router.post('/confirm/:orderId', paymentController_js_1.confirmPayment);
exports.default = router;
//# sourceMappingURL=paymentRoutes.js.map