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

const router = Router();

// Route Publik untuk Mobile & Tamu
router.get('/public', getPublicProducts);
router.get('/:id/public', getPublicProductDetail);

// Route untuk produk mitra
router.get('/', verifyToken, getProdukMitra);
router.post('/', verifyToken, upload.single('image'), tambahProduk);
router.put('/:id', verifyToken, updateProduct);
router.delete('/:id', verifyToken, hapusProduk);

export default router;
