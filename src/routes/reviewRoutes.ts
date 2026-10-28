// ============================================================
//  src/routes/reviewRoutes.ts
//  Router Ulasan & Rating Produk
// ============================================================

import { Router } from 'express';
import {
  getProductReviews,
  createReview,
  replyReview,
  voteHelpful,
} from '../controllers/reviewController.js';
import { verifyToken, requireRole } from '../middlewares/authMiddleware.js';
import { validateZod } from '../middlewares/validatorMiddleware.js';
import { createReviewSchema, replyReviewSchema } from '../validators/schemas.js';

const router = Router();

// Rute Publik
router.get('/product/:productId', getProductReviews);
router.patch('/:id/helpful', voteHelpful);

// Rute Wajib Login
router.post('/', verifyToken, validateZod(createReviewSchema), createReview);
router.post('/:id/reply', verifyToken, requireRole(['mitra', 'admin']), validateZod(replyReviewSchema), replyReview);

export default router;
