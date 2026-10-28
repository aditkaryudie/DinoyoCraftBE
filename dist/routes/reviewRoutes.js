"use strict";
// ============================================================
//  src/routes/reviewRoutes.ts
//  Router Ulasan & Rating Produk
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reviewController_js_1 = require("../controllers/reviewController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const validatorMiddleware_js_1 = require("../middlewares/validatorMiddleware.js");
const schemas_js_1 = require("../validators/schemas.js");
const router = (0, express_1.Router)();
// Rute Publik
router.get('/product/:productId', reviewController_js_1.getProductReviews);
router.patch('/:id/helpful', reviewController_js_1.voteHelpful);
// Rute Wajib Login
router.post('/', authMiddleware_js_1.verifyToken, (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.createReviewSchema), reviewController_js_1.createReview);
router.post('/:id/reply', authMiddleware_js_1.verifyToken, (0, authMiddleware_js_1.requireRole)(['mitra', 'admin']), (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.replyReviewSchema), reviewController_js_1.replyReview);
exports.default = router;
//# sourceMappingURL=reviewRoutes.js.map