import { Request, Response } from 'express';
import pool from '../config/database.js';
import { sendPushNotificationToUser } from '../services/notificationService.js';

const parseNumericOrderId = (rawId: string | number): number => {
  if (typeof rawId === 'number') return rawId;
  const str = String(rawId).trim();
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  // Format ORD-YYYYMMDD-0015 -> ambil bagian terakhir setelah '-'
  const parts = str.split('-');
  const lastPart = parts[parts.length - 1];
  const parsed = parseInt(lastPart, 10);
  return isNaN(parsed) ? 0 : parsed;
};

export const getDashboardMitra = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    if (!userId) {
      res.status(401).json({ success: false, message: 'Autentikasi gagal. User tidak ditemukan.' });
      return;
    }

    const [mitraRows]: any = await pool.query(
      'SELECT id, user_id, store_name FROM mitra_profiles WHERE user_id = ? LIMIT 1',
      [userId]
    );

    const [userRows]: any = await pool.query(
      'SELECT id, name FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const userName = userRows && userRows.length > 0 ? userRows[0].name : 'Mitra';

    const mitra = mitraRows && mitraRows.length > 0 ? mitraRows[0] : null;
    const mitraId = mitra ? mitra.id : null;
    const storeName = mitra?.store_name || userName;

    let totalProducts = 0;
    if (mitraId) {
      const [productCountRows]: any = await pool.query(
        'SELECT COUNT(*) AS total FROM products WHERE mitra_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)',
        [mitraId]
      );
      totalProducts = Number(productCountRows[0]?.total || 0);
    }

    let totalOrders = 0;
    let activeBalance = 0;
    let recentOrdersFormatted: any[] = [];

    if (mitraId) {
      const [orderCountRows]: any = await pool.query(
        'SELECT COUNT(*) AS total FROM orders WHERE mitra_id = ?',
        [mitraId]
      );
      totalOrders = Number(orderCountRows[0]?.total || 0);

      const [balanceRows]: any = await pool.query(
        "SELECT COALESCE(SUM(total_amount), 0) AS balance FROM orders WHERE mitra_id = ? AND (status IS NULL OR status != 'cancelled')",
        [mitraId]
      );
      const grossBalance = Number(balanceRows[0]?.balance || 0);

      const [withdrawRows]: any = await pool.query(
        "SELECT COALESCE(SUM(amount), 0) AS withdrawn FROM transactions WHERE (mitra_id = ? OR user_id = ?) AND transaction_type = 'withdrawal' AND status IN ('pending', 'success')",
        [mitraId, userId]
      );
      const totalWithdrawn = Number(withdrawRows[0]?.withdrawn || 0);
      activeBalance = Math.max(0, grossBalance - totalWithdrawn);

      const [orderRows]: any = await pool.query(
        `SELECT 
          o.id,
          o.created_at,
          o.status,
          COALESCE(u.name, 'Pembeli') AS customer_name,
          COALESCE((SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id), 1) AS total_items
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.mitra_id = ?
        ORDER BY o.created_at DESC
        LIMIT 5`,
        [mitraId]
      );

      const statusMap: Record<string, string> = {
        pending: 'Menunggu Pembayaran',
        paid: 'Perlu Diproses',
        packed: 'Sedang Dikemas',
        shipped: 'Sedang Dikirim',
        completed: 'Selesai',
        cancelled: 'Dibatalkan'
      };

      recentOrdersFormatted = orderRows.map((item: any) => {
        const orderDate = item.created_at ? new Date(item.created_at) : new Date();
        const dateStr = orderDate.toISOString().split('T')[0].replace(/-/g, '');
        return {
          id: `ORD-${dateStr}-00${item.id}`,
          rawId: item.id,
          items: Number(item.total_items || 1),
          customer: item.customer_name,
          status: statusMap[item.status] || item.status || 'Perlu Diproses'
        };
      });
    }

    res.status(200).json({
      success: true,
      data: {
        mitraName: storeName,
        stats: {
          totalPesanan: totalOrders,
          produkAktif: totalProducts,
          saldoAktif: activeBalance,
          kunjunganProfil: 342
        },
        recentOrders: recentOrdersFormatted
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
};

// --- 1. ENDPOINT LAPORAN KEUANGAN ---
export const getFinanceReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    if (!userId) {
      res.status(401).json({ success: false, message: 'Autentikasi gagal. User tidak ditemukan.' });
      return;
    }

    const [mitraRows]: any = await pool.query(
      'SELECT id, user_id, store_name FROM mitra_profiles WHERE user_id = ? LIMIT 1',
      [userId]
    );

    const mitra = mitraRows && mitraRows.length > 0 ? mitraRows[0] : null;
    if (!mitra) {
      res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });
      return;
    }
    const mitraId = mitra.id;

    const [orders]: any = await pool.query(
      'SELECT id, total_amount, status, created_at FROM orders WHERE mitra_id = ?',
      [mitraId]
    );

    let grossSaldo = 0;
    let pendapatanTertunda = 0;

    orders.forEach((order: any) => {
      const total = Number(order.total_amount || 0);
      const status = (order.status || '').toLowerCase();
      if (['completed', 'delivered', 'selesai', 'paid', 'shipped', 'packed'].includes(status)) {
        grossSaldo += total;
      } else if (['pending', 'processing'].includes(status)) {
        pendapatanTertunda += total;
      }
    });

    const [withdrawRows]: any = await pool.query(
      "SELECT id, amount, status, reference_code, notes, created_at FROM transactions WHERE (mitra_id = ? OR user_id = ?) AND transaction_type = 'withdrawal' ORDER BY created_at DESC",
      [mitraId, userId]
    );

    let totalDitarik = 0;
    for (const wd of withdrawRows || []) {
      if (wd.status === 'success' || wd.status === 'pending') {
        totalDitarik += Number(wd.amount || 0);
      }
    }

    const saldoAktif = Math.max(0, grossSaldo - totalDitarik);

    const [recentOrderRows]: any = await pool.query(
      `SELECT id, created_at, total_amount, status 
       FROM orders 
       WHERE mitra_id = ? 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [mitraId]
    );

    const orderHistory = recentOrderRows.map((o: any) => {
      const d = o.created_at ? new Date(o.created_at) : new Date();
      const tanggal = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      const statusStr = (o.status || '').toLowerCase();
      const statusLabel = ['completed', 'selesai', 'delivered', 'paid', 'shipped'].includes(statusStr)
        ? 'Selesai'
        : statusStr === 'cancelled'
        ? 'Dibatalkan'
        : 'Tertunda';
      return {
        id: `TRX-${String(o.id).padStart(3, '0')}`,
        tanggal,
        deskripsi: `Penjualan - INV/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/00${o.id}`,
        status: statusLabel,
        nominal: Number(o.total_amount || 0),
        timestamp: d.getTime()
      };
    });

    const withdrawHistory = (withdrawRows || []).map((wd: any) => {
      const d = wd.created_at ? new Date(wd.created_at) : new Date();
      const tanggal = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      let bankLabel = 'Rekening Bank';
      try {
        const parsed = typeof wd.notes === 'string' ? JSON.parse(wd.notes) : wd.notes;
        if (parsed && parsed.bank_name) {
          bankLabel = `${parsed.bank_name} (${parsed.account_number || ''})`;
        }
      } catch {
        if (wd.notes) bankLabel = String(wd.notes);
      }
      return {
        id: wd.reference_code || `WD-${String(wd.id).padStart(3, '0')}`,
        tanggal,
        deskripsi: `Penarikan Dana ke ${bankLabel}`,
        status: wd.status === 'failed' || wd.status === 'cancelled' ? 'Dibatalkan' : 'Selesai',
        nominal: -Math.abs(Number(wd.amount || 0)),
        timestamp: d.getTime()
      };
    });

    const riwayatTransaksi = [...withdrawHistory, ...orderHistory]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 15)
      .map(({ timestamp, ...rest }) => rest);

    res.json({
      success: true,
      data: {
        saldoAktif,
        pendapatanTertunda,
        totalDitarik,
        riwayatTransaksi
      }
    });
  } catch (error) {
    console.error('Error finance report:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const withdrawWallet = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { amount, bank_name = 'BCA', account_number = '-', account_holder = 'Mitra' } = req.body;
    const withdrawAmount = Number(amount || 0);
    if (!withdrawAmount || withdrawAmount < 50000) {
      res.status(400).json({ success: false, message: 'Minimal penarikan dana adalah Rp 50.000' });
      return;
    }

    const [mitraRows]: any = await pool.query(
      'SELECT id FROM mitra_profiles WHERE user_id = ? LIMIT 1',
      [userId]
    );
    const mitraId = mitraRows?.[0]?.id || null;

    const refCode = `WD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const notesJson = JSON.stringify({ bank_name, account_number, account_holder });

    await pool.query(
      `INSERT INTO transactions (user_id, mitra_id, transaction_type, amount, status, reference_code, notes, created_at, updated_at)
       VALUES (?, ?, 'withdrawal', ?, 'success', ?, ?, NOW(), NOW())`,
      [userId, mitraId, withdrawAmount, refCode, notesJson]
    );

    res.status(200).json({
      success: true,
      message: 'Permintaan penarikan dana berhasil diproses!',
      data: {
        reference_code: refCode,
        amount: withdrawAmount,
        bank_name,
        account_number,
        status: 'success'
      }
    });
  } catch (error) {
    console.error('Error withdrawWallet:', error);
    res.status(500).json({ success: false, message: 'Gagal memproses penarikan dana' });
  }
};

// --- 2. ENDPOINT MANAJEMEN PESANAN ---
export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    if (!userId) {
      res.status(401).json({ success: false, message: 'Autentikasi gagal. User tidak ditemukan.' });
      return;
    }

    const [mitraRows]: any = await pool.query(
      'SELECT id FROM mitra_profiles WHERE user_id = ? LIMIT 1',
      [userId]
    );

    const mitra = mitraRows && mitraRows.length > 0 ? mitraRows[0] : null;
    if (!mitra) {
      res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });
      return;
    }
    const mitraId = mitra.id;

    const [orderRows]: any = await pool.query(
      `SELECT 
        o.id,
        o.created_at,
        o.status,
        o.total_amount,
        o.shipping_method,
        o.tracking_number,
        o.shipping_address,
        o.notes,
        COALESCE(u.name, 'Customer') AS customer_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.mitra_id = ?
      ORDER BY o.created_at DESC`,
      [mitraId]
    );

    if (orderRows.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const orderIds = orderRows.map((o: any) => o.id);
    const placeholders = orderIds.map(() => '?').join(',');

    // Gunakan oi.price_at_purchase sesuai skema tabel order_items
    const [itemRows]: any = await pool.query(
      `SELECT 
        oi.order_id,
        oi.quantity,
        oi.price_at_purchase,
        oi.variant,
        p.name AS product_name,
        p.image_urls
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id IN (${placeholders})`,
      orderIds
    );

    // Ambil ulasan untuk pesanan-pesanan ini
    const [reviewRows]: any = await pool
      .query(
        `SELECT order_id, rating, comment, seller_reply
         FROM reviews
         WHERE order_id IN (${placeholders})`,
        orderIds
      )
      .catch(() => [[]]);

    const reviewsByOrder: Record<number, any> = {};
    for (const rev of reviewRows || []) {
      if (rev.order_id) {
        reviewsByOrder[rev.order_id] = {
          rating: Number(rev.rating || 5),
          comment: rev.comment || '',
          reply: rev.seller_reply || undefined
        };
      }
    }

    const itemsByOrder: Record<number, any[]> = {};
    for (const item of itemRows) {
      if (!itemsByOrder[item.order_id]) {
        itemsByOrder[item.order_id] = [];
      }
      itemsByOrder[item.order_id].push({
        productName: item.product_name || 'Produk Keramik',
        quantity: Number(item.quantity || 1),
        price: Number(item.price_at_purchase || 0),
        variant: item.variant || undefined
      });
    }

    const statusToUiMap: Record<string, string> = {
      pending: 'Perlu Dikirim',
      paid: 'Perlu Dikirim',
      packed: 'Perlu Dikirim',
      shipped: 'Dikirim',
      completed: 'Selesai',
      cancelled: 'Dibatalkan'
    };

    const formattedOrders = orderRows.map((order: any) => {
      const orderDate = order.created_at ? new Date(order.created_at) : new Date();
      const dateStr = orderDate.toISOString().split('T')[0].replace(/-/g, '');
      const rawStatus = String(order.status || 'pending').toLowerCase();
      return {
        id: order.id,
        rawId: order.id,
        orderId: `ORD-${dateStr}-00${order.id}`,
        tanggal: order.created_at,
        customerName: order.customer_name || 'Customer',
        status: statusToUiMap[rawStatus] || order.status || 'Perlu Dikirim',
        dbStatus: rawStatus,
        totalBelanja: Number(order.total_amount || 0),
        kurir: order.shipping_method || undefined,
        resi: order.tracking_number || undefined,
        shippingAddress: order.shipping_address || undefined,
        items: itemsByOrder[order.id] || [],
        review: reviewsByOrder[order.id] || undefined
      };
    });

    res.json({ success: true, data: formattedOrders });
  } catch (error) {
    console.error('Error get orders:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateOrderShipping = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawParamId = String(req.params.id || '');
    const orderId = parseNumericOrderId(rawParamId);
    const { kurir, courier, resi, tracking_number, status = 'shipped' } = req.body;
    const resolvedKurir = kurir || courier;
    const resolvedResi = resi || tracking_number;

    if (!orderId) {
      res.status(400).json({ success: false, message: 'ID pesanan tidak valid' });
      return;
    }

    const [orders]: any = await pool.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
    if (!orders || orders.length === 0) {
      res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
      return;
    }

    const order = orders[0];
    await pool.query(
      `UPDATE orders
       SET status = ?,
           shipping_method = COALESCE(?, shipping_method),
           tracking_number = COALESCE(?, tracking_number),
           updated_at = NOW()
       WHERE id = ?`,
      [status, resolvedKurir ?? null, resolvedResi ?? null, orderId]
    );

    // Simpan notifikasi ke pembeli & kirim push notification FCM
    await pool
      .query(
        `INSERT INTO notifications (user_id, title, body, type, reference_id, is_read, created_at)
         VALUES (?, ?, ?, 'order', ?, 0, NOW())`,
        [
          order.user_id,
          'Pesanan Sedang Dikirim! 🚚',
          `Pesanan #${orderId} telah dikirim melalui ${resolvedKurir || 'ekspedisi'}${resolvedResi ? ` dengan No. Resi: ${resolvedResi}` : ''}.`,
          String(orderId)
        ]
      )
      .catch(() => {});

    sendPushNotificationToUser(
      order.user_id,
      'Pesanan Sedang Dikirim! 🚚',
      `Pesanan #${orderId} dikirim via ${resolvedKurir || 'ekspedisi'}${resolvedResi ? ` (Resi: ${resolvedResi})` : ''}.`,
      { type: 'order', order_id: String(orderId), status: 'shipped', tracking_number: String(resolvedResi || '') }
    ).catch(() => {});

    res.status(200).json({
      success: true,
      message: 'Nomor resi berhasil disimpan & status pesanan diubah menjadi Dikirim!',
      data: {
        orderId: rawParamId,
        rawId: orderId,
        status: 'Dikirim',
        dbStatus: status,
        kurir: resolvedKurir,
        resi: resolvedResi
      }
    });
  } catch (error) {
    console.error('Error updateOrderShipping:', error);
    res.status(500).json({ success: false, message: 'Gagal memperbarui pengiriman pesanan' });
  }
};

export const replyOrderReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawParamId = String(req.params.id || '');
    const orderId = parseNumericOrderId(rawParamId);
    const { reply } = req.body;

    if (!orderId || !reply) {
      res.status(400).json({ success: false, message: 'ID pesanan dan isi balasan wajib diisi' });
      return;
    }

    const [existingReviews]: any = await pool.query(
      'SELECT id FROM reviews WHERE order_id = ? LIMIT 1',
      [orderId]
    );

    if (existingReviews && existingReviews.length > 0) {
      await pool.query(
        'UPDATE reviews SET seller_reply = ?, updated_at = NOW() WHERE order_id = ?',
        [reply, orderId]
      );
    } else {
      const [orderRows]: any = await pool.query('SELECT user_id FROM orders WHERE id = ? LIMIT 1', [orderId]);
      const [itemRows]: any = await pool.query('SELECT product_id FROM order_items WHERE order_id = ? LIMIT 1', [orderId]);
      if (orderRows?.length > 0 && itemRows?.length > 0) {
        await pool.query(
          `INSERT INTO reviews (product_id, user_id, order_id, rating, comment, seller_reply, created_at, updated_at)
           VALUES (?, ?, ?, 5, 'Produk berkualitas sangat baik.', ?, NOW(), NOW())`,
          [itemRows[0].product_id, orderRows[0].user_id, orderId, reply]
        );
      }
    }

    res.status(200).json({
      success: true,
      message: 'Balasan ulasan berhasil dikirim!',
      data: { orderId: rawParamId, rawId: orderId, reply }
    });
  } catch (error) {
    console.error('Error replyOrderReview:', error);
    res.status(500).json({ success: false, message: 'Gagal menyimpan balasan ulasan' });
  }
};

// --- 3. ENDPOINT EDIT PRODUK (FIX KATALOG BUG) ---
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, title, price, stock, category_id, description, image_url } = req.body;
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];

    if (!userId) {
      res.status(401).json({ success: false, message: 'Autentikasi gagal. User tidak ditemukan.' });
      return;
    }

    const [mitraRows]: any = await pool.query(
      'SELECT id FROM mitra_profiles WHERE user_id = ? LIMIT 1',
      [userId]
    );

    const mitra = mitraRows && mitraRows.length > 0 ? mitraRows[0] : null;
    if (!mitra) {
      res.status(404).json({ success: false, message: 'Profil mitra tidak ditemukan' });
      return;
    }
    const mitraId = mitra.id;

    const [prodRows]: any = await pool.query(
      'SELECT * FROM products WHERE id = ? AND mitra_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) LIMIT 1',
      [id, mitraId]
    );

    if (!prodRows || prodRows.length === 0) {
      res.status(404).json({ success: false, message: 'Produk tidak ditemukan atau Anda tidak memiliki akses' });
      return;
    }

    const existingProduct = prodRows[0];

    const updatedName = name !== undefined ? name : title !== undefined ? title : existingProduct.name;
    const updatedPrice = price !== undefined ? parseFloat(price) : existingProduct.price;
    const updatedStock = stock !== undefined ? parseInt(stock) : existingProduct.stock;
    const updatedDesc = description !== undefined ? description : existingProduct.description;

    let updatedCategoryId = existingProduct.category_id;
    if (category_id !== undefined) {
      const parsedCat = parseInt(category_id);
      if (!isNaN(parsedCat)) {
        updatedCategoryId = parsedCat;
      } else {
        const [catRows]: any = await pool.query('SELECT id FROM categories WHERE name = ? LIMIT 1', [category_id]);
        if (catRows && catRows.length > 0) {
          updatedCategoryId = catRows[0].id;
        }
      }
    }

    let updatedImageUrls = existingProduct.image_urls;
    if (req.file) {
      updatedImageUrls = JSON.stringify([`/uploads/${req.file.filename}`]);
    } else if (image_url && typeof image_url === 'string' && image_url.trim()) {
      updatedImageUrls = JSON.stringify([image_url.trim()]);
    }

    await pool.query(
      `UPDATE products 
       SET name = ?, description = ?, price = ?, stock = ?, category_id = ?, image_urls = ?, updated_at = NOW() 
       WHERE id = ? AND mitra_id = ?`,
      [updatedName, updatedDesc, updatedPrice, updatedStock, updatedCategoryId, updatedImageUrls, id, mitraId]
    );

    const [updatedRows]: any = await pool.query('SELECT * FROM products WHERE id = ? LIMIT 1', [id]);

    res.json({
      success: true,
      message: 'Produk berhasil diperbarui!',
      data: updatedRows && updatedRows.length > 0 ? updatedRows[0] : existingProduct
    });
  } catch (error) {
    console.error('Error update product:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getPublicMitraStores = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search } = req.query;
    let query = `
      SELECT 
        m.id,
        m.user_id,
        m.store_name,
        m.store_name AS name,
        m.workshop_address,
        m.workshop_address AS location,
        m.whatsapp_number,
        m.started_year,
        m.description,
        m.website,
        m.instagram,
        m.banner_url,
        COALESCE(m.avatar_url, u.avatar_url) AS avatar_url,
        COALESCE(m.avatar_url, u.avatar_url) AS image,
        (SELECT COUNT(*) FROM products p WHERE p.mitra_id = m.id AND (p.is_deleted = 0 OR p.is_deleted IS NULL)) AS total_products
      FROM mitra_profiles m
      LEFT JOIN users u ON m.user_id = u.id
      WHERE (m.is_active = 1 OR m.is_active IS NULL)
    `;
    const params: any[] = [];
    if (search) {
      query += ' AND (m.store_name LIKE ? OR m.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY m.id DESC';

    const [rows]: any = await pool.query(query, params);
    const stores = rows.map((r: any) => ({
      ...r,
      rating: 4.9
    }));

    res.status(200).json({
      success: true,
      message: 'Daftar toko mitra berhasil diambil',
      data: stores,
      meta: { timestamp: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Error getPublicMitraStores:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil daftar toko' });
  }
};

export const getPublicMitraDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [stores]: any = await pool.query(
      `SELECT 
        m.id,
        m.user_id,
        m.store_name,
        m.store_name AS name,
        m.workshop_address,
        m.workshop_address AS location,
        m.whatsapp_number,
        m.started_year,
        m.description,
        m.website,
        m.instagram,
        m.banner_url,
        COALESCE(m.avatar_url, u.avatar_url) AS avatar_url,
        COALESCE(m.avatar_url, u.avatar_url) AS image
      FROM mitra_profiles m
      LEFT JOIN users u ON m.user_id = u.id
      WHERE m.id = ?
      LIMIT 1`,
      [id]
    );

    if (!stores || stores.length === 0) {
      res.status(404).json({ success: false, message: 'Toko mitra tidak ditemukan' });
      return;
    }

    const store = { ...stores[0], rating: 4.9 };

    const [products]: any = await pool.query(
      `SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.stock,
        p.image_urls,
        c.name AS category
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.mitra_id = ? AND (p.is_deleted = 0 OR p.is_deleted IS NULL)
      ORDER BY p.created_at DESC`,
      [id]
    );

    const formattedProducts = products.map((p: any) => {
      let img = '';
      if (p.image_urls) {
        try {
          const parsed = typeof p.image_urls === 'string' ? JSON.parse(p.image_urls) : p.image_urls;
          img = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : '';
        } catch {
          img = String(p.image_urls);
        }
      }
      return {
        id: String(p.id),
        name: p.name,
        price: Number(p.price),
        stock: Number(p.stock),
        category: p.category || 'Keramik',
        image: img,
        image_url: img
      };
    });

    res.status(200).json({
      success: true,
      message: 'Detail toko mitra berhasil diambil',
      data: {
        ...store,
        products: formattedProducts
      },
      meta: { timestamp: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Error getPublicMitraDetail:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil detail toko' });
  }
};
