// ============================================================
//  src/controllers/reviewController.ts
//  Controller Ulasan & Rating Produk Keramik
// ============================================================

import { Request, Response } from 'express';
import pool from '../config/database.js';
import { sendSuccess, sendCreated, sendNotFound, sendForbidden, sendError } from '../utils/response.js';

export const getProductReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;

    const [reviews]: any = await pool.query(
      `SELECT 
         r.id,
         r.rating,
         r.variant,
         r.comment,
         r.photo_urls,
         r.helpful_count,
         r.seller_reply,
         r.replied_at,
         r.created_at,
         u.name AS user_name,
         u.avatar_url AS user_avatar
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = ?
       ORDER BY r.id DESC`,
      [productId]
    );

    const formattedReviews = reviews.map((rev: any) => {
      let photos = [];
      if (typeof rev.photo_urls === 'string') {
        try { photos = JSON.parse(rev.photo_urls); } catch { photos = []; }
      } else if (Array.isArray(rev.photo_urls)) {
        photos = rev.photo_urls;
      }
      return { ...rev, photo_urls: photos };
    });

    // Hitung ringkasan rating
    const totalReviews = formattedReviews.length;
    const avgRating =
      totalReviews > 0
        ? Number(
            (formattedReviews.reduce((acc: number, curr: any) => acc + curr.rating, 0) / totalReviews).toFixed(1)
          )
        : 0;

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    formattedReviews.forEach((rev: any) => {
      if (distribution[rev.rating] !== undefined) {
        distribution[rev.rating]++;
      }
    });

    sendSuccess(
      res,
      {
        totalReviews,
        avgRating,
        distribution,
        reviews: formattedReviews,
      },
      'Daftar ulasan produk berhasil diambil.'
    );
  } catch (error) {
    console.error('❌ [getProductReviews] Error:', error);
    sendError(res, 'Gagal mengambil ulasan produk.');
  }
};

export const createReview = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const userId = res.locals['userId'];
    const { product_id, order_item_id, rating, variant, comment, photo_urls } = req.body;

    // 1. Cek apakah produk valid
    const [products]: any = await connection.query(
      'SELECT id, mitra_id FROM products WHERE id = ? AND is_deleted = 0',
      [product_id]
    );

    if (products.length === 0) {
      await connection.rollback();
      sendNotFound(res, 'Produk tidak ditemukan.');
      return;
    }

    const mitraId = products[0].mitra_id;

    // 2. Simpan ulasan
    const [result]: any = await connection.query(
      `INSERT INTO reviews (product_id, user_id, order_item_id, rating, variant, comment, photo_urls)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        product_id,
        userId,
        order_item_id || null,
        rating,
        variant || null,
        comment || null,
        photo_urls ? JSON.stringify(photo_urls) : null,
      ]
    );

    // 3. Update cache rating produk
    const [prodStats]: any = await connection.query(
      'SELECT COUNT(*) as total, AVG(rating) as avg_rating FROM reviews WHERE product_id = ?',
      [product_id]
    );
    const prodTotal = prodStats[0]?.total || 0;
    const prodAvg = prodStats[0]?.avg_rating ? Number(prodStats[0].avg_rating).toFixed(2) : 0;

    await connection.query(
      'UPDATE products SET rating = ?, total_reviews = ? WHERE id = ?',
      [prodAvg, prodTotal, product_id]
    );

    // 4. Update cache rating toko mitra
    const [mitraStats]: any = await connection.query(
      `SELECT COUNT(r.id) as total, AVG(r.rating) as avg_rating 
       FROM reviews r
       JOIN products p ON r.product_id = p.id
       WHERE p.mitra_id = ?`,
      [mitraId]
    );
    const mitraTotal = mitraStats[0]?.total || 0;
    const mitraAvg = mitraStats[0]?.avg_rating ? Number(mitraStats[0].avg_rating).toFixed(2) : 0;

    await connection.query(
      'UPDATE mitra_profiles SET rating = ?, total_reviews = ? WHERE id = ?',
      [mitraAvg, mitraTotal, mitraId]
    );

    await connection.commit();

    const [newReview]: any = await pool.query('SELECT * FROM reviews WHERE id = ?', [result.insertId]);
    sendCreated(res, newReview[0], 'Ulasan berhasil dikirim. Terima kasih atas masukan Anda!');
  } catch (error) {
    await connection.rollback();
    console.error('❌ [createReview] Error:', error);
    sendError(res, 'Gagal mengirim ulasan.');
  } finally {
    connection.release();
  }
};

export const replyReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals['userId'];
    const role = res.locals['role'];
    const { id } = req.params;
    const { seller_reply } = req.body;

    const [reviewRows]: any = await pool.query(
      `SELECT r.id, p.mitra_id, m.user_id AS mitra_user_id 
       FROM reviews r
       JOIN products p ON r.product_id = p.id
       JOIN mitra_profiles m ON p.mitra_id = m.id
       WHERE r.id = ?`,
      [id]
    );

    if (reviewRows.length === 0) {
      sendNotFound(res, 'Ulasan tidak ditemukan.');
      return;
    }

    const review = reviewRows[0];
    if (role !== 'admin' && review.mitra_user_id !== userId) {
      sendForbidden(res, 'Hanya pemilik toko mitra yang boleh membalas ulasan ini.');
      return;
    }

    await pool.query(
      'UPDATE reviews SET seller_reply = ?, replied_at = NOW() WHERE id = ?',
      [seller_reply, id]
    );

    sendSuccess(res, null, 'Balasan ulasan berhasil dikirim.');
  } catch (error) {
    console.error('❌ [replyReview] Error:', error);
    sendError(res, 'Gagal membalas ulasan.');
  }
};

export const voteHelpful = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = ?', [id]);
    sendSuccess(res, null, 'Terima kasih atas tanggapan Anda.');
  } catch (error) {
    console.error('❌ [voteHelpful] Error:', error);
    sendError(res, 'Gagal memberikan vote.');
  }
};
