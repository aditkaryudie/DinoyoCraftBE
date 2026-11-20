// ============================================================
//  src/routes/reviewRoutes.ts
//  Router Ulasan & Rating Produk
// ============================================================

import { Router } from 'express';
import {
  getProductReviews,
  getStoreReviews,
  createReview,
  replyReview,
  voteHelpful,
} from '../controllers/reviewController.js';
import { verifyToken, requireRole } from '../middlewares/authMiddleware.js';
import { validateZod } from '../middlewares/validatorMiddleware.js';
import { createReviewSchema, replyReviewSchema } from '../validators/schemas.js';
import upload from '../middlewares/uploadMiddleware.js';

const router = Router();

// Rute Publik
router.get('/product/:productId', getProductReviews);
router.get('/store', getStoreReviews);
router.patch('/:id/helpful', voteHelpful);

// Rute Wajib Login (mendukung JSON maupun multipart upload foto ulasan)
router.post('/', verifyToken, upload.any(), validateZod(createReviewSchema), createReview);
router.post('/:id/reply', verifyToken, requireRole(['mitra', 'admin']), validateZod(replyReviewSchema), replyReview);

export default router;

