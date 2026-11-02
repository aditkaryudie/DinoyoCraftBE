"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reviewController_js_1 = require("../controllers/reviewController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const router = (0, express_1.Router)();
// Publik
router.get('/product/:id', reviewController_js_1.getProductReviews);
router.patch('/:id/helpful', reviewController_js_1.markReviewHelpful);
// Terautentikasi
router.post('/', authMiddleware_js_1.verifyToken, reviewController_js_1.createReview);
exports.default = router;
//# sourceMappingURL=reviewRoutes.js.map