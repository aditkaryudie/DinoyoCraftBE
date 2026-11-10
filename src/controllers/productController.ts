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

export const getPublicProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, search, sort, store_id, mitra_id, page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = ['(p.is_deleted = 0 OR p.is_deleted IS NULL)'];
    const params: any[] = [];

    const targetStoreId = store_id || mitra_id;
    if (targetStoreId) {
      conditions.push('p.mitra_id = ?');
      params.push(targetStoreId);
    }

    if (category) {
      conditions.push('(c.name = ? OR c.id = ?)');
      params.push(category, category);
    }

    if (search) {
      conditions.push('(p.name LIKE ? OR p.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    let orderBy = 'p.created_at DESC';
    if (sort === 'price_asc') {
      orderBy = 'p.price ASC';
    } else if (sort === 'price_desc') {
      orderBy = 'p.price DESC';
    } else if (sort === 'name_asc') {
      orderBy = 'p.name ASC';
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        p.id,
        p.mitra_id,
        p.category_id,
        p.name,
        p.name AS title,
        p.description,
        p.price,
        p.stock,
        p.image_urls,
        p.created_at,
        p.updated_at,
        COALESCE(c.name, 'Keramik') AS category,
        COALESCE(c.name, 'Keramik') AS category_name,
        COALESCE(m.store_name, 'Toko Keramik') AS studio,
        COALESCE(m.store_name, 'Toko Keramik') AS store_name,
        m.workshop_address,
        m.avatar_url AS store_avatar_url
      FROM products p
      LEFT JOIN mitra_profiles m ON p.mitra_id = m.id
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    params.push(limitNum, offset);
    const [rows]: any = await pool.query(query, params);

    const products = rows.map((row: any) => {
      let imageUrls: string[] = [];
      if (row.image_urls) {
        try {
          const parsed = typeof row.image_urls === 'string' ? JSON.parse(row.image_urls) : row.image_urls;
          if (Array.isArray(parsed)) {
            imageUrls = parsed;
          } else if (typeof parsed === 'string') {
            imageUrls = [parsed];
          }
        } catch {
          imageUrls = [String(row.image_urls)];
        }
      }

      const mainImage = imageUrls.length > 0 ? imageUrls[0] : '';

      return {
        id: String(row.id),
        name: row.name,
        title: row.title,
        description: row.description || '',
        price: Number(row.price),
        stock: Number(row.stock),
        category: row.category,
        category_id: row.category_id,
        category_name: row.category_name,
        studio: row.studio,
        store_name: row.store_name,
        workshop_address: row.workshop_address,
        mitra_id: row.mitra_id,
        rating: 4.8,
        image: mainImage || 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=400&q=80',
        image_url: mainImage,
        images: imageUrls,
        created_at: row.created_at,
      };
    });

    res.status(200).json({
      success: true,
      message: 'Berhasil mengambil katalog produk publik',
      data: products,
      meta: {
        page: pageNum,
        limit: limitNum,
        count: products.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getPublicProducts:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data produk' });
  }
};

export const getPublicProductDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        p.id,
        p.mitra_id,
        p.category_id,
        p.name,
        p.name AS title,
        p.description,
        p.price,
        p.stock,
        p.image_urls,
        p.created_at,
        p.updated_at,
        COALESCE(c.name, 'Keramik') AS category,
        COALESCE(c.name, 'Keramik') AS category_name,
        COALESCE(m.store_name, 'Toko Keramik') AS studio,
        COALESCE(m.store_name, 'Toko Keramik') AS store_name,
        m.workshop_address,
        m.whatsapp_number,
        m.description AS store_description,
        m.avatar_url AS store_avatar_url,
        m.banner_url AS store_banner_url
      FROM products p
      LEFT JOIN mitra_profiles m ON p.mitra_id = m.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ? AND (p.is_deleted = 0 OR p.is_deleted IS NULL)
      LIMIT 1
    `;

    const [rows]: any = await pool.query(query, [id]);
    if (!rows || rows.length === 0) {
      res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
      return;
    }

    const row = rows[0];
    let imageUrls: string[] = [];
    if (row.image_urls) {
      try {
        const parsed = typeof row.image_urls === 'string' ? JSON.parse(row.image_urls) : row.image_urls;
        if (Array.isArray(parsed)) {
          imageUrls = parsed;
        } else if (typeof parsed === 'string') {
          imageUrls = [parsed];
        }
      } catch {
        imageUrls = [String(row.image_urls)];
      }
    }

    const mainImage = imageUrls.length > 0 ? imageUrls[0] : '';

    const product = {
      id: String(row.id),
      name: row.name,
      title: row.title,
      description: row.description || '',
      price: Number(row.price),
      stock: Number(row.stock),
      category: row.category,
      category_id: row.category_id,
      category_name: row.category_name,
      studio: row.studio,
      store_name: row.store_name,
      mitra_id: row.mitra_id,
      rating: 4.8,
      image: mainImage,
      image_url: mainImage,
      images: imageUrls,
      store: {
        id: row.mitra_id,
        name: row.store_name,
        store_name: row.store_name,
        location: row.workshop_address,
        workshop_address: row.workshop_address,
        whatsapp_number: row.whatsapp_number,
        description: row.store_description,
        avatar_url: row.store_avatar_url,
        banner_url: row.store_banner_url,
        rating: 4.9,
      },
      created_at: row.created_at,
    };

    res.status(200).json({
      success: true,
      message: 'Detail produk berhasil diambil',
      data: product,
      meta: { timestamp: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Error getPublicProductDetail:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil detail produk' });
  }
};