import { Router } from 'express';
import {
  getProductReviews,
  createReview,
  markReviewHelpful
} from '../controllers/reviewController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

// Publik
router.get('/product/:id', getProductReviews);
router.patch('/:id/helpful', markReviewHelpful);

// Terautentikasi
router.post('/', verifyToken, createReview);

export default router;

