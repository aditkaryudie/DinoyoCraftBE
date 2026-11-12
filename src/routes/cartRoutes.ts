// ============================================================
//  src/routes/cartRoutes.ts
//  Router Keranjang Belanja Pelanggan
// ============================================================

import { Router } from 'express';
import {
  getCart,
  addToCart,
  updateCartItem,
  deleteCartItem,
  clearCart,
} from '../controllers/cartController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { validateZod } from '../middlewares/validatorMiddleware.js';
import { addToCartSchema, updateCartSchema } from '../validators/schemas.js';

const router = Router();

// Semua rute keranjang wajib login
router.use(verifyToken);

router.get('/', getCart);
router.post('/', validateZod(addToCartSchema), addToCart);
router.put('/:id', validateZod(updateCartSchema), updateCartItem);
router.delete('/:id', deleteCartItem);
router.delete('/', clearCart);

export default router;

