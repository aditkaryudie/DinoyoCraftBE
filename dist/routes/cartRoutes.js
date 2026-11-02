"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cartController_js_1 = require("../controllers/cartController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const router = (0, express_1.Router)();
router.use(authMiddleware_js_1.verifyToken);
router.get('/', cartController_js_1.getCart);
router.post('/', cartController_js_1.addToCart);
router.put('/:id', cartController_js_1.updateCartItem);
router.delete('/:id', cartController_js_1.removeCartItem);
router.delete('/', cartController_js_1.clearCart);
exports.default = router;
//# sourceMappingURL=cartRoutes.js.map