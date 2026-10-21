import { Request, Response } from 'express';
import pool from '../config/database.js';

export const getStoreProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    if (!userId) {
      res.status(401).json({ success: false, message: 'Autentikasi gagal. User tidak ditemukan.' });
      return;
    }

    // 1. Ambil profil toko beserta banner dan avatar (gabung dengan users untuk fallback avatar & nama)
    const [storeRows]: any = await pool.query(
      `SELECT 
        m.id,
        m.user_id,
        m.store_name,
        m.workshop_address,
        m.description,
        COALESCE(m.avatar_url, u.avatar_url) AS avatar_url,
        m.banner_url,
        u.name AS owner_name
      FROM mitra_profiles m
      LEFT JOIN users u ON m.user_id = u.id
      WHERE m.user_id = ?
      LIMIT 1`,
      [userId]
    );

    if (!storeRows || storeRows.length === 0) {
      res.status(404).json({ success: false, message: 'Toko belum dikonfigurasi' });
      return;
    }

    const store = storeRows[0];

    // Format avatar_url & banner_url jika relative path
    let avatarUrl = store.avatar_url || null;
    if (avatarUrl && !avatarUrl.startsWith('http')) {
      avatarUrl = `http://localhost:5000${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
    }

    let bannerUrl = store.banner_url || null;
    if (bannerUrl && !bannerUrl.startsWith('http')) {
      bannerUrl = `http://localhost:5000${bannerUrl.startsWith('/') ? '' : '/'}${bannerUrl}`;
    }

    // 2. Ambil semua produk milik toko ini
    const [productRows]: any = await pool.query(
      `SELECT 
        id,
        name,
        price,
        image_urls,
        created_at
      FROM products
      WHERE mitra_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
      ORDER BY created_at DESC`,
      [store.id]
    );

    const products = productRows.map((p: any) => {
      let imageUrl = null;
      if (p.image_urls) {
        try {
          const parsed = typeof p.image_urls === 'string' ? JSON.parse(p.image_urls) : p.image_urls;
          if (Array.isArray(parsed) && parsed.length > 0) {
            imageUrl = parsed[0];
          } else if (typeof parsed === 'string') {
            imageUrl = parsed;
          }
        } catch {
          imageUrl = String(p.image_urls);
        }
      }

      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = `http://localhost:5000${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
      }

      return {
        id: p.id,
        name: p.name,
        price: Number(p.price),
        imageUrl: imageUrl,
        isHot: true,
        rating: 4.9,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        store: {
          name: store.store_name || store.owner_name || 'Toko Mitra',
          address: store.workshop_address || 'Alamat belum diatur',
          description: store.description || 'Belum ada deskripsi toko.',
          avatarUrl: avatarUrl,
          bannerUrl: bannerUrl,
          rating: 4.9,
          reviewCount: 128,
        },
        products: products,
      },
    });
  } catch (error) {
    console.error('Error fetching store profile:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};
