"use strict";
// ============================================================
//  src/routes/cartRoutes.ts
//  Router Keranjang Belanja Pelanggan
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cartController_js_1 = require("../controllers/cartController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const validatorMiddleware_js_1 = require("../middlewares/validatorMiddleware.js");
const schemas_js_1 = require("../validators/schemas.js");
const router = (0, express_1.Router)();
// Semua rute keranjang wajib login
router.use(authMiddleware_js_1.verifyToken);
router.get('/', cartController_js_1.getCart);
router.post('/', (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.addToCartSchema), cartController_js_1.addToCart);
router.put('/:id', (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.updateCartSchema), cartController_js_1.updateCartItem);
router.delete('/:id', cartController_js_1.deleteCartItem);
router.delete('/', cartController_js_1.clearCart);
exports.default = router;
//# sourceMappingURL=cartRoutes.js.map