// ============================================================
//  src/routes/productRoutes.ts
//  Router Katalog Produk Keramik
// ============================================================

import { Router } from 'express';
import {
  tambahProduk,
  getProdukMitra,
  hapusProduk,
  getPublicProducts,
  getPublicProductDetail
} from '../controllers/productController.js';
import { updateProduct } from '../controllers/mitraController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';
import { validateZod } from '../middlewares/validatorMiddleware.js';
import { createProductSchema, updateProductSchema } from '../validators/schemas.js';

const router = Router();

// Route Publik untuk Mobile & Tamu
router.get('/public', getPublicProducts);
router.get('/:id/public', getPublicProductDetail);

// Route untuk produk mitra
router.get('/', verifyToken, getProdukMitra);
router.post('/', verifyToken, upload.single('image'), validateZod(createProductSchema), tambahProduk);
router.put('/:id', verifyToken, validateZod(updateProductSchema), updateProduct);
router.delete('/:id', verifyToken, hapusProduk);

export default router;
