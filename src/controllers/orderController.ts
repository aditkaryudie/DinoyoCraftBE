// ============================================================
//  src/controllers/orderController.ts
//  Controller Transaksi, Pesanan, & Manajemen Status Pesanan
// ============================================================

import { Request, Response } from 'express';
import pool from '../config/database.js';
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendForbidden, sendError } from '../utils/response.js';

export const checkout = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const userId = res.locals['userId'];
    const {
      mitra_id,
      address_id,
      shipping_method = 'Reguler',
      shipping_cost = 0,
      customer_notes = null,
      payment_method = 'qris',
      items,
    } = req.body;

    // 1. Validasi Alamat
    const [addresses]: any = await connection.query(
      'SELECT id, full_address, recipient_name, phone FROM user_addresses WHERE id = ? AND user_id = ?',
      [address_id, userId]
    );

    if (addresses.length === 0) {
      await connection.rollback();
      sendBadRequest(res, 'Alamat pengiriman tidak valid.');
      return;
    }

    // 2. Validasi Mitra
    const [mitras]: any = await connection.query(
      'SELECT id, user_id, store_name FROM mitra_profiles WHERE id = ? AND is_active = 1',
      [mitra_id]
    );

    if (mitras.length === 0) {
      await connection.rollback();
      sendBadRequest(res, 'Toko mitra tidak valid atau sedang tidak aktif.');
      return;
    }

    // 3. Validasi Produk & Hitung Subtotal
    let totalItemsAmount = 0;
    const validatedItems: any[] = [];

    for (const item of items) {
      const [prodRows]: any = await connection.query(
        'SELECT id, name, price, stock, is_deleted FROM products WHERE id = ? FOR UPDATE',
        [item.product_id]
      );

      if (prodRows.length === 0 || prodRows[0].is_deleted) {
        await connection.rollback();
        sendBadRequest(res, `Produk dengan ID ${item.product_id} tidak ditemukan atau sudah dihapus.`);
        return;
      }

      const prod = prodRows[0];
      if (prod.stock < item.quantity) {
        await connection.rollback();
        sendBadRequest(res, `Stok produk '${prod.name}' tidak mencukupi (tersedia: ${prod.stock}, diminta: ${item.quantity}).`);
        return;
      }

      const unitPrice = Number(prod.price);
      totalItemsAmount += unitPrice * item.quantity;

      validatedItems.push({
        product_id: prod.id,
        name: prod.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        variant: item.variant || null,
      });
    }

    const grandTotal = totalItemsAmount + Number(shipping_cost);

    // 4. Buat Kode Referensi Transaksi Unik
    const refCode = `TRX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 5. Simpan ke Tabel Transactions
    const [trxResult]: any = await connection.query(
      `INSERT INTO transactions (user_id, transaction_type, amount, status, reference_code, notes)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
      [userId, payment_method, grandTotal, refCode, customer_notes]
    );
    const transactionId = trxResult.insertId;

    // 6. Simpan ke Tabel Orders
    const [orderResult]: any = await connection.query(
      `INSERT INTO orders (user_id, mitra_id, address_id, transaction_id, total_amount, shipping_cost, shipping_method, customer_notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [userId, mitra_id, address_id, transactionId, grandTotal, shipping_cost, shipping_method, customer_notes]
    );
    const orderId = orderResult.insertId;

    // 7. Simpan ke Tabel Order Items & Kurangi Stok Produk
    for (const item of validatedItems) {
      await connection.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, variant)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.quantity, item.unit_price, item.variant]
      );

      await connection.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );

      // Hapus item dari keranjang user jika ada
      await connection.query(
        'DELETE FROM carts WHERE user_id = ? AND product_id = ?',
        [userId, item.product_id]
      );
    }

    // 8. Kirim Notifikasi Sistem ke Mitra & Pelanggan
    await connection.query(
      `INSERT INTO notifications (user_id, title, message, type, reference_id)
       VALUES (?, ?, ?, 'order', ?)`,
      [
        mitras[0].user_id,
        'Pesanan Baru Masuk!',
        `Toko Anda menerima pesanan baru #${orderId} sebesar Rp ${grandTotal.toLocaleString('id-ID')}.`,
        orderId,
      ]
    );

    await connection.query(
      `INSERT INTO notifications (user_id, title, message, type, reference_id)
       VALUES (?, ?, ?, 'order', ?)`,
      [
        userId,
        'Pesanan Berhasil Dibuat',
        `Pesanan #${orderId} di toko ${mitras[0].store_name} berhasil dibuat. Silakan selesaikan pembayaran.`,
        orderId,
      ]
    );

    await connection.commit();

    sendCreated(
      res,
      {
        order_id: orderId,
        reference_code: refCode,
        total_amount: grandTotal,
        payment_method,
        status: 'pending',
      },
      'Pesanan berhasil dibuat.'
    );
  } catch (error) {
    await connection.rollback();
    console.error('❌ [checkout] Error:', error);
    sendError(res, 'Gagal memproses pesanan.');
  } finally {
    connection.release();
  }
};

export const getUserOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals['userId'];
    const { status } = req.query;

    let query = `
      SELECT 
        o.id,
        o.total_amount,
        o.shipping_cost,
        o.shipping_method,
        o.tracking_number,
        o.customer_notes,
        o.status,
        o.created_at,
        m.id AS mitra_id,
        m.store_name,
        m.whatsapp_number AS mitra_phone,
        t.reference_code,
        t.transaction_type AS payment_method,
        t.status AS payment_status
      FROM orders o
      JOIN mitra_profiles m ON o.mitra_id = m.id
      LEFT JOIN transactions t ON o.transaction_id = t.id
      WHERE o.user_id = ?
    `;

    const params: any[] = [userId];
    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }
    query += ' ORDER BY o.id DESC';

    const [orders]: any = await pool.query(query, params);

    // Ambil order items untuk masing-masing order
    for (const order of orders) {
      const [items]: any = await pool.query(
        `SELECT 
           oi.id,
           oi.product_id,
           oi.quantity,
           oi.unit_price,
           oi.variant,
           p.name AS product_name,
           p.image_urls
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [order.id]
      );

      order.items = items.map((item: any) => {
        let images = [];
        if (typeof item.image_urls === 'string') {
          try { images = JSON.parse(item.image_urls); } catch { images = []; }
        } else if (Array.isArray(item.image_urls)) {
          images = item.image_urls;
        }
        return { ...item, image_urls: images };
      });
    }

    sendSuccess(res, orders, 'Daftar riwayat pesanan berhasil diambil.');
  } catch (error) {
    console.error('❌ [getUserOrders] Error:', error);
    sendError(res, 'Gagal mengambil riwayat pesanan.');
  }
};

export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals['userId'];
    const role = res.locals['role'];
    const { id } = req.params;

    const [orders]: any = await pool.query(
      `SELECT 
         o.*,
         m.store_name,
         m.whatsapp_number AS mitra_phone,
         m.workshop_address,
         m.user_id AS mitra_user_id,
         a.recipient_name,
         a.phone AS recipient_phone,
         a.full_address,
         a.city,
         a.postal_code,
         t.reference_code,
         t.transaction_type AS payment_method,
         t.status AS payment_status
       FROM orders o
       JOIN mitra_profiles m ON o.mitra_id = m.id
       LEFT JOIN user_addresses a ON o.address_id = a.id
       LEFT JOIN transactions t ON o.transaction_id = t.id
       WHERE o.id = ?`,
      [id]
    );

    if (orders.length === 0) {
      sendNotFound(res, 'Pesanan tidak ditemukan.');
      return;
    }

    const order = orders[0];

    // Cek otorisasi: hanya pembeli, mitra pemilik toko, atau admin yang boleh melihat
    if (role !== 'admin' && order.user_id !== userId && order.mitra_user_id !== userId) {
      sendForbidden(res, 'Anda tidak memiliki hak untuk melihat pesanan ini.');
      return;
    }

    const [items]: any = await pool.query(
      `SELECT 
         oi.*,
         p.name AS product_name,
         p.image_urls
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [id]
    );

    order.items = items.map((item: any) => {
      let images = [];
      if (typeof item.image_urls === 'string') {
        try { images = JSON.parse(item.image_urls); } catch { images = []; }
      } else if (Array.isArray(item.image_urls)) {
        images = item.image_urls;
      }
      return { ...item, image_urls: images };
    });

    sendSuccess(res, order, 'Detail pesanan berhasil diambil.');
  } catch (error) {
    console.error('❌ [getOrderById] Error:', error);
    sendError(res, 'Gagal mengambil detail pesanan.');
  }
};

export const getMitraOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals['userId'];
    const { status } = req.query;

    const [mitraRows]: any = await pool.query('SELECT id FROM mitra_profiles WHERE user_id = ?', [userId]);
    if (mitraRows.length === 0) {
      sendForbidden(res, 'Profil mitra tidak ditemukan.');
      return;
    }
    const mitraId = mitraRows[0].id;

    let query = `
      SELECT 
        o.id,
        o.total_amount,
        o.shipping_cost,
        o.shipping_method,
        o.tracking_number,
        o.customer_notes,
        o.status,
        o.created_at,
        u.name AS customer_name,
        u.email AS customer_email,
        a.recipient_name,
        a.phone AS recipient_phone,
        a.full_address,
        a.city,
        a.postal_code,
        t.reference_code,
        t.status AS payment_status
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN user_addresses a ON o.address_id = a.id
      LEFT JOIN transactions t ON o.transaction_id = t.id
      WHERE o.mitra_id = ?
    `;

    const params: any[] = [mitraId];
    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }
    query += ' ORDER BY o.id DESC';

    const [orders]: any = await pool.query(query, params);

    for (const order of orders) {
      const [items]: any = await pool.query(
        `SELECT 
           oi.*,
           p.name AS product_name,
           p.image_urls
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }

    sendSuccess(res, orders, 'Daftar pesanan toko berhasil diambil.');
  } catch (error) {
    console.error('❌ [getMitraOrders] Error:', error);
    sendError(res, 'Gagal mengambil daftar pesanan toko.');
  }
};

export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const userId = res.locals['userId'];
    const role = res.locals['role'];
    const { id } = req.params;
    const { status, tracking_number } = req.body;

    const [orders]: any = await connection.query(
      `SELECT o.*, m.user_id AS mitra_user_id 
       FROM orders o
       JOIN mitra_profiles m ON o.mitra_id = m.id
       WHERE o.id = ?`,
      [id]
    );

    if (orders.length === 0) {
      await connection.rollback();
      sendNotFound(res, 'Pesanan tidak ditemukan.');
      return;
    }

    const order = orders[0];

    // Hanya admin atau pemilik toko mitra yang boleh update status pengiriman
    if (role !== 'admin' && order.mitra_user_id !== userId) {
      await connection.rollback();
      sendForbidden(res, 'Anda tidak berwenang mengubah status pesanan ini.');
      return;
    }

    // Jika pesanan dibatalkan (cancelled), kembalikan stok produk
    if (status === 'cancelled' && order.status !== 'cancelled') {
      const [items]: any = await connection.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [id]);
      for (const item of items) {
        await connection.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
      }
    }

    await connection.query(
      `UPDATE orders SET 
         status = ?,
         tracking_number = COALESCE(?, tracking_number)
       WHERE id = ?`,
      [status, tracking_number || null, id]
    );

    // Kirim notifikasi status terbaru ke customer
    const statusMessages: Record<string, string> = {
      paid: 'Pembayaran pesanan Anda telah diverifikasi.',
      packed: 'Pesanan Anda sedang dikemas dengan rapi oleh pengrajin.',
      shipped: `Pesanan Anda telah dikirim! No. Resi: ${tracking_number || '-'}`,
      completed: 'Pesanan Anda telah selesai. Jangan lupa beri ulasan terbaik!',
      cancelled: 'Pesanan Anda telah dibatalkan.',
    };

    if (statusMessages[status]) {
      await connection.query(
        `INSERT INTO notifications (user_id, title, message, type, reference_id)
         VALUES (?, ?, ?, 'order', ?)`,
        [order.user_id, `Status Pesanan #${id}: ${status.toUpperCase()}`, statusMessages[status], id]
      );
    }

    await connection.commit();

    sendSuccess(res, { order_id: Number(id), status, tracking_number }, 'Status pesanan berhasil diperbarui.');
  } catch (error) {
    await connection.rollback();
    console.error('❌ [updateOrderStatus] Error:', error);
    sendError(res, 'Gagal memperbarui status pesanan.');
  } finally {
    connection.release();
  }
};
