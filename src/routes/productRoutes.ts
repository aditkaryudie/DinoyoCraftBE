import { Router } from 'express';
import { tambahProduk, getProdukMitra, hapusProduk } from '../controllers/productController.js';
import { updateProduct } from '../controllers/mitraController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import upload from '../middlewares/uploadMiddleware.js';

const router = Router();

// Route untuk produk mitra
router.get('/', verifyToken, getProdukMitra);
router.post('/', verifyToken, upload.single('image'), tambahProduk);
router.put('/:id', verifyToken, updateProduct);
router.delete('/:id', verifyToken, hapusProduk);

export default router;