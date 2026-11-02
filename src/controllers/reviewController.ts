import { Request, Response } from 'express';
import pool from '../config/database.js';

export const getProductReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        r.id,
        r.user_id,
        r.product_id,
        r.rating,
        r.comment,
        r.variant,
        r.photo_urls,
        r.helpful_count,
        r.created_at,
        u.name AS reviewer_name,
        u.avatar_url AS reviewer_avatar
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.product_id = ?
      ORDER BY r.created_at DESC
    `;

    const [rows]: any = await pool.query(query, [id]).catch(() => [[]]);

    const formattedReviews = rows.map((r: any) => {
      let photos: string[] = [];
      if (r.photo_urls) {
        try {
          const parsed = typeof r.photo_urls === 'string' ? JSON.parse(r.photo_urls) : r.photo_urls;
          if (Array.isArray(parsed)) photos = parsed;
        } catch {
          photos = [String(r.photo_urls)];
        }
      }

      return {
        id: r.id,
        user_id: r.user_id,
        name: r.reviewer_name || 'Pembeli DinoyoCraft',
        avatar_url: r.reviewer_avatar,
        rating: Number(r.rating),
        comment: r.comment || '',
        variant: r.variant || 'Default',
        photos,
        helpful_count: Number(r.helpful_count || 0),
        created_at: r.created_at,
      };
    });

    // Kalkulasi rata-rata rating
    const totalReviews = formattedReviews.length;
    const avgRating = totalReviews > 0
      ? formattedReviews.reduce((acc: number, cur: any) => acc + cur.rating, 0) / totalReviews
      : 5.0;

    res.status(200).json({
      success: true,
      data: {
        product_id: Number(id),
        average_rating: Number(avgRating.toFixed(1)),
        total_reviews: totalReviews,
        reviews: formattedReviews
      }
    });
  } catch (error) {
    console.error('Error getProductReviews:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil ulasan produk' });
  }
};

export const createReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { product_id, rating = 5, comment, variant, photo_urls } = req.body;
    if (!product_id) {
      res.status(400).json({ success: false, message: 'product_id wajib diisi' });
      return;
    }

    const photoUrlsJson = photo_urls ? JSON.stringify(photo_urls) : null;

    const [result]: any = await pool.query(
      `INSERT INTO reviews (user_id, product_id, rating, comment, variant, photo_urls, helpful_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
      [userId, product_id, Number(rating), comment || '', variant || null, photoUrlsJson]
    );

    res.status(201).json({
      success: true,
      message: 'Ulasan berhasil dikirim! Terima kasih atas ulasan Anda.',
      reviewId: result.insertId
    });
  } catch (error) {
    console.error('Error createReview:', error);
    res.status(500).json({ success: false, message: 'Gagal mengirim ulasan' });
  }
};

export const markReviewHelpful = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = ?', [id]);
    res.status(200).json({ success: true, message: 'Ulasan ditandai bermanfaat' });
  } catch (error) {
    console.error('Error markReviewHelpful:', error);
    res.status(500).json({ success: false, message: 'Gagal menandai ulasan bermanfaat' });
  }
};

