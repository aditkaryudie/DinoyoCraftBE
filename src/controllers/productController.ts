import { Request, Response } from 'express';
import pool from '../config/database.js';

export interface ProductVariantItem {
  name: string;
  hex: string;
  label: string;
  stock: number;
}

export const parseImageUrls = (raw: unknown): string[] => {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      return parsed.filter((u) => typeof u === 'string' && u.trim() !== '').map((u) => u.trim());
    }
    if (typeof parsed === 'string' && parsed.trim() !== '') {
      return [parsed.trim()];
    }
  } catch {
    const str = String(raw).trim();
    if (str) return [str];
  }
  return [];
};

export const parseVariants = (raw: unknown): ProductVariantItem[] => {
  if (!raw) return [];
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === 'null' || trimmed === '[]') return [];
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  const result: ProductVariantItem[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const name = String(item['name'] ?? item['label'] ?? '').trim();
    if (!name) continue;
    const hex = String(item['hex'] ?? '#b85c3c').trim() || '#b85c3c';
    const label = String(item['label'] ?? 'Standar').trim() || 'Standar';
    const rawStock = Number(item['stock']);
    const stock = Number.isFinite(rawStock) ? Math.max(0, Math.floor(rawStock)) : 0;
    result.push({ name, hex, label, stock });
  }
  return result;
};

export const serializeVariantsInput = (raw: unknown): ProductVariantItem[] | null => {
  const list = parseVariants(raw);
  return list.length > 0 ? list : null;
};

export const getVariantAvailableStock = (
  rawVariants: unknown,
  totalStock: number,
  variantName?: string | null
): number => {
  const variants = parseVariants(rawVariants);
  const normalizedTarget = typeof variantName === 'string' ? variantName.trim().toLowerCase() : '';
  if (variants.length > 0 && normalizedTarget) {
    const matched = variants.find((v) => v.name.trim().toLowerCase() === normalizedTarget);
    if (matched) return matched.stock;
  }
  return Math.max(0, Number(totalStock) || 0);
};

export const adjustProductStockAndVariant = async (
  connection: any,
  productId: number,
  deltaQty: number,
  variantName?: string | null
): Promise<void> => {
  const [rows]: any = await connection.query(
    'SELECT stock, variants FROM products WHERE id = ? FOR UPDATE',
    [productId]
  );
  if (!rows || rows.length === 0) return;

  const currentStock = Number(rows[0].stock) || 0;
  const variants = parseVariants(rows[0].variants);
  const target = typeof variantName === 'string' ? variantName.trim().toLowerCase() : '';

  if (variants.length > 0 && target) {
    let matched = false;
    const updatedVariants = variants.map((v) => {
      if (!matched && v.name.trim().toLowerCase() === target) {
        matched = true;
        return { ...v, stock: Math.max(0, v.stock + deltaQty) };
      }
      return v;
    });
    if (matched) {
      const nextStock = updatedVariants.reduce((sum, v) => sum + v.stock, 0);
      await connection.query(
        'UPDATE products SET stock = ?, variants = ? WHERE id = ?',
        [nextStock, JSON.stringify(updatedVariants), productId]
      );
      return;
    }
  }

  const nextStock = Math.max(0, currentStock + deltaQty);
  await connection.query('UPDATE products SET stock = ? WHERE id = ?', [nextStock, productId]);
};

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
        p.weight_gram,
        p.variants,
        p.image_urls,
        p.rating,
        p.total_reviews,
        p.created_at,
        COALESCE(c.name, 'Dekorasi') AS category
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.mitra_id = ? AND (p.is_deleted = 0 OR p.is_deleted IS NULL)
      ORDER BY p.created_at DESC
    `;

    const [rows]: any = await pool.query(query, [mitraId]);

    const products = rows.map((row: any) => {
      const imageUrls = parseImageUrls(row.image_urls);
      let imageUrl = imageUrls.length > 0 ? imageUrls[0] : '';

      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = `http://localhost:5000${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
      }

      const variants = parseVariants(row.variants);

      return {
        id: String(row.id),
        title: row.title,
        description: row.description || '',
        price: Number(row.price),
        category: row.category,
        stock: Number(row.stock),
        weight_gram: Number(row.weight_gram) || 500,
        image_url: imageUrl || 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=400&q=80',
        variants,
        rating: Number(row.total_reviews) > 0 ? Number(row.rating) : 0,
        total_reviews: Number(row.total_reviews) || 0,
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

    const { name, description, price, stock, category_id, image_url, variants, weight_gram } = req.body;

    // Validasi input (izinkan stok 0 atau harga 0 bila valid)
    if (!name || price === undefined || price === '' || stock === undefined || stock === '' || !category_id) {
      res.status(400).json({ success: false, message: 'Semua field wajib diisi' });
      return;
    }

    // Parse category_id (bisa berupa ID angka atau nama kategori)
    let parsedCategoryId = parseInt(category_id);
    if (isNaN(parsedCategoryId)) {
      const [catRows]: any = await pool.query('SELECT id FROM categories WHERE name = ? LIMIT 1', [category_id]);
      parsedCategoryId = catRows && catRows.length > 0 ? catRows[0].id : 1;
    }

    // Tangani file foto jika diupload, atau URL foto eksternal
    const file = req.file;
    const rawUrl = typeof image_url === 'string' ? image_url.trim() : '';
    const imageUrls = file
      ? JSON.stringify([`/uploads/${file.filename}`])
      : rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))
        ? JSON.stringify([rawUrl])
        : null;

    const normalizedVariants = serializeVariantsInput(variants);
    const finalStock = normalizedVariants && normalizedVariants.length > 0
      ? normalizedVariants.reduce((sum, v) => sum + v.stock, 0)
      : Math.max(0, parseInt(stock, 10) || 0);
    const finalWeight = Math.max(1, parseInt(weight_gram, 10) || 500);

    const query = `
      INSERT INTO products (mitra_id, category_id, name, description, price, stock, weight_gram, variants, image_urls, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const [result]: any = await pool.query(query, [
      mitraId,
      parsedCategoryId,
      name,
      description || '',
      parseFloat(price) || 0,
      finalStock,
      finalWeight,
      normalizedVariants ? JSON.stringify(normalizedVariants) : null,
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
        p.weight_gram,
        p.variants,
        p.image_urls,
        p.rating,
        p.total_reviews,
        p.created_at,
        p.updated_at,
        COALESCE(c.name, 'Keramik') AS category,
        COALESCE(c.name, 'Keramik') AS category_name,
        COALESCE(m.store_name, 'Toko Keramik') AS studio,
        COALESCE(m.store_name, 'Toko Keramik') AS store_name,
        m.workshop_address,
        m.avatar_url AS store_avatar_url,
        COALESCE(
          (SELECT SUM(oi.quantity)
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.id
           WHERE oi.product_id = p.id AND o.status != 'cancelled'),
          0
        ) AS sold_count
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
      const imageUrls = parseImageUrls(row.image_urls);
      const mainImage = imageUrls.length > 0 ? imageUrls[0] : '';
      const totalReviews = Number(row.total_reviews) || 0;
      const rating = totalReviews > 0 ? Number(row.rating) : 0;

      return {
        id: String(row.id),
        name: row.name,
        title: row.title,
        description: row.description || '',
        price: Number(row.price),
        stock: Number(row.stock),
        weight_gram: Number(row.weight_gram) || 500,
        variants: parseVariants(row.variants),
        category: row.category,
        category_id: row.category_id,
        category_name: row.category_name,
        studio: row.studio,
        store_name: row.store_name,
        workshop_address: row.workshop_address,
        mitra_id: row.mitra_id,
        rating,
        total_reviews: totalReviews,
        sold_count: Number(row.sold_count) || 0,
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
        p.weight_gram,
        p.variants,
        p.image_urls,
        p.rating,
        p.total_reviews,
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
        m.banner_url AS store_banner_url,
        COALESCE(
          (SELECT SUM(oi.quantity)
           FROM order_items oi
           JOIN orders o ON oi.order_id = o.id
           WHERE oi.product_id = p.id AND o.status != 'cancelled'),
          0
        ) AS sold_count
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
    const imageUrls = parseImageUrls(row.image_urls);
    const mainImage = imageUrls.length > 0 ? imageUrls[0] : '';

    // Ambil ulasan nyata produk dari database
    const [reviewRows]: any = await pool.query(
      `SELECT r.id, r.rating, r.variant, r.comment, r.photo_urls, r.helpful_count,
              r.seller_reply, r.replied_at, r.created_at, u.name AS user_name
       FROM reviews r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.product_id = ?
       ORDER BY r.id DESC
       LIMIT 10`,
      [id]
    );

    const formattedReviews = (reviewRows || []).map((rev: any) => ({
      id: rev.id,
      rating: Number(rev.rating) || 5,
      variant: rev.variant || '',
      comment: rev.comment || '',
      photo_urls: parseImageUrls(rev.photo_urls),
      helpful_count: Number(rev.helpful_count) || 0,
      seller_reply: rev.seller_reply || null,
      replied_at: rev.replied_at || null,
      created_at: rev.created_at,
      user_name: rev.user_name || 'Pembeli',
    }));

    const totalReviews = Number(row.total_reviews) || formattedReviews.length;
    const rating =
      totalReviews > 0
        ? (Number(row.rating) > 0
            ? Number(row.rating)
            : Number(
                (
                  formattedReviews.reduce((s: number, r: any) => s + Number(r.rating || 0), 0) /
                  formattedReviews.length
                ).toFixed(1)
              ))
        : 0;

    const product = {
      id: String(row.id),
      name: row.name,
      title: row.title,
      description: row.description || '',
      price: Number(row.price),
      stock: Number(row.stock),
      weight_gram: Number(row.weight_gram) || 500,
      variants: parseVariants(row.variants),
      category: row.category,
      category_id: row.category_id,
      category_name: row.category_name,
      studio: row.studio,
      store_name: row.store_name,
      workshop_address: row.workshop_address,
      mitra_id: row.mitra_id,
      rating,
      total_reviews: totalReviews,
      sold_count: Number(row.sold_count) || 0,
      reviews: formattedReviews,
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
        rating,
        total_reviews: totalReviews,
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