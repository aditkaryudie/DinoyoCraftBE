"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mitraController_js_1 = require("../controllers/mitraController.js");
const storeController_js_1 = require("../controllers/storeController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const router = express_1.default.Router();
// Route terlindungi oleh middleware verifyToken
router.get('/dashboard', authMiddleware_js_1.verifyToken, mitraController_js_1.getDashboardMitra);
// Route untuk halaman Toko Saya
router.get('/store-profile', authMiddleware_js_1.verifyToken, storeController_js_1.getStoreProfile);
// 3 Endpoint Baru Mitra
router.get('/finance', authMiddleware_js_1.verifyToken, mitraController_js_1.getFinanceReport);
router.get('/orders', authMiddleware_js_1.verifyToken, mitraController_js_1.getOrders);
router.put('/products/:id', authMiddleware_js_1.verifyToken, mitraController_js_1.updateProduct);
exports.default = router;
//# sourceMappingURL=mitraRoutes.js.map