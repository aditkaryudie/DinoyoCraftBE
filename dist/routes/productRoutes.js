"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const productController_js_1 = require("../controllers/productController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const uploadMiddleware_js_1 = __importDefault(require("../middlewares/uploadMiddleware.js"));
const router = (0, express_1.Router)();
// Route untuk produk mitra
router.get('/', authMiddleware_js_1.verifyToken, productController_js_1.getProdukMitra);
router.post('/', authMiddleware_js_1.verifyToken, uploadMiddleware_js_1.default.single('image'), productController_js_1.tambahProduk);
router.delete('/:id', authMiddleware_js_1.verifyToken, productController_js_1.hapusProduk);
exports.default = router;
//# sourceMappingURL=productRoutes.js.map