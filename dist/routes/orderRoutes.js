"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orderController_js_1 = require("../controllers/orderController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const router = (0, express_1.Router)();
router.use(authMiddleware_js_1.verifyToken);
router.post('/checkout', orderController_js_1.checkoutOrder);
router.get('/', orderController_js_1.getOrders);
router.get('/:id/tracking', orderController_js_1.getOrderTracking);
router.post('/:id/cancel', orderController_js_1.cancelOrder);
router.get('/:id', orderController_js_1.getOrderDetail);
router.patch('/:id/status', orderController_js_1.updateOrderStatus);
exports.default = router;
//# sourceMappingURL=orderRoutes.js.map