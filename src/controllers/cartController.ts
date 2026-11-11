// ============================================================
//  src/controllers/cartController.ts
//  Controller Keranjang Belanja Pelanggan
// ============================================================

import { Request, Response } from 'express';
import pool from '../config/database.js';
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendError } from '../utils/response.js';
import { getVariantAvailableStock } from './productController.js';

export const getCart = async (_req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals['userId'];

    const [items]: any = await pool.query(
      `SELECT 
         c.id,
         c.product_id,
         c.quantity,
         c.variant,
         c.created_at,
         p.name AS product_name,
         p.price AS product_price,
         p.stock AS product_stock,
         p.weight_gram,
         p.image_urls,
         m.id AS mitra_id,
         m.store_name,
         m.workshop_address
       FROM carts c
       JOIN products p ON c.product_id = p.id
       JOIN mitra_profiles m ON p.mitra_id = m.id
       WHERE c.user_id = ? AND p.is_deleted = 0
       ORDER BY c.id DESC`,
      [userId]
    );

    // Format foto produk jika JSON string
    const formattedItems = items.map((item: any) => {
      let images = [];
      if (typeof item.image_urls === 'string') {
        try { images = JSON.parse(item.image_urls); } catch { images = []; }
      } else if (Array.isArray(item.image_urls)) {
        images = item.image_urls;
      }
      return {
        ...item,
        image_urls: images,
        subtotal: Number(item.product_price) * item.quantity,
      };
    });

    const totalQuantity = formattedItems.reduce((acc: number, item: any) => acc + item.quantity, 0);
    const totalPrice = formattedItems.reduce((acc: number, item: any) => acc + item.subtotal, 0);

    sendSuccess(
      res,
      {
        items: formattedItems,
        totalQuantity,
        totalPrice,
      },
      'Data keranjang berhasil diambil.'
    );
  } catch (error) {
    console.error('❌ [getCart] Error:', error);
    sendError(res, 'Gagal mengambil data keranjang belanja.');
  }
};

export const addToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals['userId'];
    const { product_id, quantity = 1, variant = null } = req.body;

    // 1. Cek apakah produk tersedia dan aktif
    const [products]: any = await pool.query(
      'SELECT id, name, price, stock, variants, is_deleted FROM products WHERE id = ?',
      [product_id]
    );

    if (products.length === 0 || products[0].is_deleted) {
      sendNotFound(res, 'Produk tidak ditemukan atau sudah tidak tersedia.');
      return;
    }

    const product = products[0];
    const availableStock = getVariantAvailableStock(product.variants, Number(product.stock) || 0, variant);

    // 2. Cek apakah produk dan varian yang sama sudah ada di keranjang
    const [existingCart]: any = await pool.query(
      'SELECT id, quantity FROM carts WHERE user_id = ? AND product_id = ? AND (variant = ? OR (variant IS NULL AND ? IS NULL))',
      [userId, product_id, variant, variant]
    );

    if (existingCart.length > 0) {
      const newQuantity = existingCart[0].quantity + quantity;
      if (newQuantity > availableStock) {
        sendBadRequest(res, `Stok produk tidak mencukupi (tersisa ${availableStock}).`);
        return;
      }

      await pool.query('UPDATE carts SET quantity = ? WHERE id = ?', [newQuantity, existingCart[0].id]);
      const [updated]: any = await pool.query('SELECT * FROM carts WHERE id = ?', [existingCart[0].id]);
      sendSuccess(res, updated[0], 'Jumlah produk di keranjang berhasil diperbarui.');
      return;
    }

    // 3. Tambah baru ke keranjang
    if (quantity > availableStock) {
      sendBadRequest(res, `Stok produk tidak mencukupi (tersisa ${availableStock}).`);
      return;
    }

    const [result]: any = await pool.query(
      'INSERT INTO carts (user_id, product_id, quantity, variant) VALUES (?, ?, ?, ?)',
      [userId, product_id, quantity, variant]
    );

    const [newItem]: any = await pool.query('SELECT * FROM carts WHERE id = ?', [result.insertId]);
    sendCreated(res, newItem[0], 'Produk berhasil ditambahkan ke keranjang.');
  } catch (error) {
    console.error('❌ [addToCart] Error:', error);
    sendError(res, 'Gagal menambahkan produk ke keranjang.');
  }
};

export const updateCartItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals['userId'];
    const { id } = req.params;
    const { quantity, variant } = req.body;

    const [cartItem]: any = await pool.query(
      `SELECT c.id, c.product_id, c.quantity, c.variant, p.stock, p.variants 
       FROM carts c
       JOIN products p ON c.product_id = p.id
       WHERE c.id = ? AND c.user_id = ?`,
      [id, userId]
    );

    if (cartItem.length === 0) {
      sendNotFound(res, 'Item keranjang tidak ditemukan.');
      return;
    }

    const effectiveVariant = variant !== undefined ? variant : cartItem[0].variant;
    const availableStock = getVariantAvailableStock(cartItem[0].variants, Number(cartItem[0].stock) || 0, effectiveVariant);
    if (quantity !== undefined && quantity > availableStock) {
      sendBadRequest(res, `Stok produk tidak mencukupi (tersisa ${availableStock}).`);
      return;
    }

    await pool.query(
      `UPDATE carts SET 
         quantity = COALESCE(?, quantity),
         variant = COALESCE(?, variant)
       WHERE id = ? AND user_id = ?`,
      [quantity, variant, id, userId]
    );

    const [updated]: any = await pool.query('SELECT * FROM carts WHERE id = ?', [id]);
    sendSuccess(res, updated[0], 'Item keranjang berhasil diperbarui.');
  } catch (error) {
    console.error('❌ [updateCartItem] Error:', error);
    sendError(res, 'Gagal memperbarui item keranjang.');
  }
};

export const deleteCartItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals['userId'];
    const { id } = req.params;

    const [result]: any = await pool.query(
      'DELETE FROM carts WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (result.affectedRows === 0) {
      sendNotFound(res, 'Item keranjang tidak ditemukan.');
      return;
    }

    sendSuccess(res, null, 'Item berhasil dihapus dari keranjang.');
  } catch (error) {
    console.error('❌ [deleteCartItem] Error:', error);
    sendError(res, 'Gagal menghapus item dari keranjang.');
  }
};

export const clearCart = async (_req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals['userId'];
    await pool.query('DELETE FROM carts WHERE user_id = ?', [userId]);
    sendSuccess(res, null, 'Keranjang belanja berhasil dikosongkan.');
  } catch (error) {
    console.error('❌ [clearCart] Error:', error);
    sendError(res, 'Gagal mengosongkan keranjang belanja.');
  }
};
