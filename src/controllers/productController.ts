import { Request, Response } from 'express';
import pool from '../config/database.js';

export const getProdukMitra = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    if (!userId) {
      res.status(401).json({ success: false, message: 'Autentikasi gagal. User tidak ditemukan.' });
      return;
    }

    const [profiles]: any = await pool.query('SELECT id FROM mitra_profiles WHERE user_id = ? LIMIT 1', [userId]);
    if (!profiles || profiles.length === 0) {
      res.status(200).json({ success: true, data: [] });
      return;
    }
    const mitraId = profiles[0].id;

    const query = `
      SELECT 
        p.id,
        p.name AS title,
        p.description,
        p.price,
        p.stock,
        p.image_urls,
        p.created_at,
        COALESCE(c.name, 'Dekorasi') AS category
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.mitra_id = ? AND (p.is_deleted = 0 OR p.is_deleted IS NULL)
      ORDER BY p.created_at DESC
    `;

    const [rows]: any = await pool.query(query, [mitraId]);

    const products = rows.map((row: any) => {
      let imageUrl = '';
      if (row.image_urls) {
        try {
          const parsed = typeof row.image_urls === 'string' ? JSON.parse(row.image_urls) : row.image_urls;
          if (Array.isArray(parsed) && parsed.length > 0) {
            imageUrl = parsed[0];
          } else if (typeof parsed === 'string') {
            imageUrl = parsed;
          }
        } catch {
          imageUrl = String(row.image_urls);
        }
      }

      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = `http://localhost:5000${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
      }

      return {
        id: String(row.id),
        title: row.title,
        description: row.description || '',
        price: Number(row.price),
        category: row.category,
        stock: Number(row.stock),
        image_url: imageUrl || 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=400&q=80',
        variants: [],
        reviews: [],
      };
    });

    res.status(200).json({ success: true, data: products });
  } catch (error) {
    console.error('Error ambil produk mitra:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data produk' });
  }
};

export const tambahProduk = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    if (!userId) {
      res.status(401).json({ success: false, message: 'Autentikasi gagal. User tidak ditemukan.' });
      return;
    }

    // Ambil ID profil mitra berdasarkan user_id
    const [profiles]: any = await pool.query('SELECT id FROM mitra_profiles WHERE user_id = ? LIMIT 1', [userId]);
    if (!profiles || profiles.length === 0) {
      res.status(403).json({ success: false, message: 'Profil mitra tidak ditemukan. Silakan lengkapi profil toko terlebih dahulu.' });
      return;
    }
    const mitraId = profiles[0].id;

    const { name, description, price, stock, category_id } = req.body;

    // Validasi input
    if (!name || !price || !stock || !category_id) {
      res.status(400).json({ success: false, message: 'Semua field wajib diisi' });
      return;
    }

    // Parse category_id (bisa berupa ID angka atau nama kategori)
    let parsedCategoryId = parseInt(category_id);
    if (isNaN(parsedCategoryId)) {
      const [catRows]: any = await pool.query('SELECT id FROM categories WHERE name = ? LIMIT 1', [category_id]);
      parsedCategoryId = catRows && catRows.length > 0 ? catRows[0].id : 1;
    }

    // Tangani file foto jika diupload
    const file = req.file;
    const imageUrls = file ? JSON.stringify([`/uploads/${file.filename}`]) : null;

    const query = `
      INSERT INTO products (mitra_id, category_id, name, description, price, stock, image_urls, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const [result]: any = await pool.query(query, [
      mitraId,
      parsedCategoryId,
      name,
      description || '',
      parseFloat(price) || 0,
      parseInt(stock) || 0,
      imageUrls,
    ]);

    res.status(201).json({
      success: true,
      message: 'Produk berhasil ditambahkan',
      productId: result?.insertId,
    });
  } catch (error) {
    console.error('Error tambah produk:', error);
    res.status(500).json({ success: false, message: 'Gagal menambahkan produk' });
  }
};

export const hapusProduk = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    const { id } = req.params;

    const [profiles]: any = await pool.query('SELECT id FROM mitra_profiles WHERE user_id = ? LIMIT 1', [userId]);
    if (!profiles || profiles.length === 0) {
      res.status(403).json({ success: false, message: 'Profil mitra tidak ditemukan.' });
      return;
    }
    const mitraId = profiles[0].id;

    await pool.query('UPDATE products SET is_deleted = 1 WHERE id = ? AND mitra_id = ?', [id, mitraId]);

    res.status(200).json({ success: true, message: 'Produk berhasil dihapus' });
  } catch (error) {
    console.error('Error hapus produk:', error);
    res.status(500).json({ success: false, message: 'Gagal menghapus produk' });
  }
};