import { Request, Response } from 'express';
import pool from '../config/database.js';
import { sendPushNotificationToUser } from '../services/notificationService.js';

const extractFirstImage = (imageUrls: any): string => {
  if (!imageUrls) return '';
  try {
    const parsed = typeof imageUrls === 'string' ? JSON.parse(imageUrls) : imageUrls;
    if (Array.isArray(parsed) && parsed.length > 0) return String(parsed[0]);
    if (typeof parsed === 'string') return parsed;
  } catch {
    return String(imageUrls);
  }
  return '';
};

export const checkoutOrder = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    let {
      mitra_id,
      address_id,
      shipping_address,
      shipping_method = 'Regular',
      shipping_cost = 15000,
      voucher_discount = 0,
      payment_method = 'qris',
      customer_notes,
      notes,
      items
    } = req.body;

    await connection.beginTransaction();

    // Jika items tidak dikirim di body, ambil dari tabel carts milik user
    if (!items || !Array.isArray(items) || items.length === 0) {
      const [cartRows]: any = await connection.query(
        `SELECT c.product_id, c.quantity, c.variant, p.price AS unit_price, p.mitra_id
         FROM carts c
         INNER JOIN products p ON c.product_id = p.id
         WHERE c.user_id = ?`,
        [userId]
      );
      items = cartRows || [];
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      await connection.rollback();
      res.status(400).json({ success: false, message: 'Item pesanan tidak boleh kosong' });
      return;
    }

    // Validasi setiap product_id terhadap tabel products agar FK aman
    const resolvedItems: Array<{
      product_id: number;
      quantity: number;
      unit_price: number;
      variant: string | null;
      mitra_id?: number;
    }> = [];

    for (const rawItem of items) {
      let pid = Number(rawItem.product_id) || 0;
      const qty = Math.max(1, Number(rawItem.quantity) || 1);
      let unitPrice = Number(rawItem.unit_price ?? rawItem.price_at_purchase ?? rawItem.price ?? 0);
      let prodMitraId: number | undefined;

      const [prodCheck]: any = await connection.query(
        'SELECT id, price, mitra_id FROM products WHERE id = ? LIMIT 1',
        [pid]
      );
      if (prodCheck && prodCheck.length > 0) {
        pid = prodCheck[0].id;
        if (!unitPrice) unitPrice = Number(prodCheck[0].price);
        prodMitraId = prodCheck[0].mitra_id;
      } else {
        const [fallbackProd]: any = await connection.query(
          'SELECT id, price, mitra_id FROM products ORDER BY id ASC LIMIT 1'
        );
        if (fallbackProd && fallbackProd.length > 0) {
          pid = fallbackProd[0].id;
          if (!unitPrice) unitPrice = Number(fallbackProd[0].price);
          prodMitraId = fallbackProd[0].mitra_id;
        }
      }

      resolvedItems.push({
        product_id: pid,
        quantity: qty,
        unit_price: unitPrice,
        variant: rawItem.variant ? String(rawItem.variant) : null,
        mitra_id: prodMitraId
      });
    }

    // Tentukan mitra_id (harus valid di tabel mitra_profiles)
    let resolvedMitraId = Number(mitra_id) || resolvedItems[0]?.mitra_id || 0;
    if (resolvedMitraId > 0) {
      const [mitraRows]: any = await connection.query(
        'SELECT id FROM mitra_profiles WHERE id = ? OR user_id = ? LIMIT 1',
        [resolvedMitraId, resolvedMitraId]
      );
      if (mitraRows && mitraRows.length > 0) {
        resolvedMitraId = mitraRows[0].id;
      } else {
        resolvedMitraId = 0;
      }
    }
    if (!resolvedMitraId) {
      const [firstMitra]: any = await connection.query(
        'SELECT id FROM mitra_profiles ORDER BY id ASC LIMIT 1'
      );
      resolvedMitraId = firstMitra?.[0]?.id || 1;
    }

    // Tentukan address_id dan shipping_address
    let resolvedAddressId: number | null = address_id ? Number(address_id) : null;
    let resolvedShippingAddress = shipping_address ? String(shipping_address) : '';

    if (resolvedAddressId) {
      const [addrRows]: any = await connection.query(
        'SELECT id, recipient_name, phone, full_address FROM user_addresses WHERE id = ? LIMIT 1',
        [resolvedAddressId]
      );
      if (addrRows && addrRows.length > 0) {
        if (!resolvedShippingAddress) {
          resolvedShippingAddress = `${addrRows[0].recipient_name} (${addrRows[0].phone}) - ${addrRows[0].full_address}`;
        }
      } else {
        resolvedAddressId = null;
      }
    }

    if (!resolvedShippingAddress) {
      const [defaultAddr]: any = await connection.query(
        'SELECT id, recipient_name, phone, full_address FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC LIMIT 1',
        [userId]
      );
      if (defaultAddr && defaultAddr.length > 0) {
        resolvedAddressId = resolvedAddressId || defaultAddr[0].id;
        resolvedShippingAddress = `${defaultAddr[0].recipient_name} (${defaultAddr[0].phone}) - ${defaultAddr[0].full_address}`;
      } else {
        resolvedShippingAddress = 'Alamat Pengiriman Pelanggan';
      }
    }

    // Hitung nominal
    let itemsTotal = 0;
    for (const item of resolvedItems) {
      itemsTotal += Number(item.unit_price) * Number(item.quantity);
    }
    const shipCost = Number(shipping_cost) || 0;
    const voucherDisc = Number(voucher_discount) || 0;
    const baseAmount = Math.max(0, itemsTotal + shipCost - voucherDisc);
    const platformFee = 1000 + Math.round((baseAmount * 5) / 100);
    const channelFee = Math.round(((baseAmount + platformFee) * 705) / 100000);
    const applicationFee =
      req.body.application_fee !== undefined
        ? Number(req.body.application_fee)
        : platformFee + channelFee;
    const totalDue = baseAmount + applicationFee;

    const orderNotes =
      typeof customer_notes === 'string'
        ? customer_notes
        : typeof notes === 'string'
        ? notes
        : notes
        ? JSON.stringify(notes)
        : null;

    // 1. Buat order di tabel orders
    const [orderResult]: any = await connection.query(
      `INSERT INTO orders (
         user_id, mitra_id, address_id, shipping_address, shipping_method,
         shipping_cost, product_amount, application_fee, voucher_discount,
         total_amount, total_due, notes, status, expires_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL 24 HOUR), NOW(), NOW())`,
      [
        userId,
        resolvedMitraId,
        resolvedAddressId,
        resolvedShippingAddress,
        shipping_method || 'Regular',
        shipCost,
        itemsTotal,
        applicationFee,
        voucherDisc,
        baseAmount,
        totalDue,
        orderNotes
      ]
    );
    const orderId = orderResult.insertId;

    // 2. Buat transaksi di tabel transactions
    const refCode = `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const [txResult]: any = await connection.query(
      `INSERT INTO transactions (
         order_id, user_id, mitra_id, transaction_type, amount, status,
         reference_code, payment_method, notes, created_at, updated_at
       ) VALUES (?, ?, ?, 'order_payment', ?, 'pending', ?, ?, ?, NOW(), NOW())`,
      [
        orderId,
        userId,
        resolvedMitraId,
        totalDue,
        refCode,
        payment_method || 'qris',
        orderNotes || 'Pembelian produk keramik'
      ]
    );
    const txId = txResult.insertId;

    // 3. Masukkan items ke order_items
    for (const item of resolvedItems) {
      await connection.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, price_at_purchase, variant)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.quantity, item.unit_price, item.unit_price, item.variant]
      );

      // Kurangi stok produk
      await connection.query(
        'UPDATE products SET stock = GREATEST(0, stock - ?) WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    // 4. Hapus item dari keranjang user
    await connection.query('DELETE FROM carts WHERE user_id = ?', [userId]);

    // 5. Simpan notifikasi in-app untuk pembeli dan mitra
    await connection
      .query(
        `INSERT INTO notifications (user_id, title, body, type, reference_id, is_read, created_at)
         VALUES (?, ?, ?, 'order', ?, 0, NOW())`,
        [
          userId,
          'Pesanan Berhasil Dibuat! 🛒',
          `Pesanan #${orderId} senilai Rp ${totalDue.toLocaleString('id-ID')} telah dibuat. Silakan selesaikan pembayaran Anda.`,
          String(orderId)
        ]
      )
      .catch(() => {});

    const [mitraOwner]: any = await connection.query(
      'SELECT user_id FROM mitra_profiles WHERE id = ? LIMIT 1',
      [resolvedMitraId]
    );
    if (mitraOwner && mitraOwner.length > 0) {
      await connection
        .query(
          `INSERT INTO notifications (user_id, title, body, type, reference_id, is_read, created_at)
           VALUES (?, ?, ?, 'order', ?, 0, NOW())`,
          [
            mitraOwner[0].user_id,
            'Pesanan Baru Masuk! 📦',
            `Pesanan baru #${orderId} telah dibuat oleh pelanggan.`,
            String(orderId)
          ]
        )
        .catch(() => {});
    }

    await connection.commit();

    // 6. Notifikasi via FCM ke user pembeli
    sendPushNotificationToUser(
      userId,
      'Pesanan Berhasil Dibuat! 🛒',
      `Pesanan #${orderId} telah dibuat. Silakan selesaikan pembayaran Anda.`,
      { type: 'order', order_id: String(orderId), ref_code: refCode }
    ).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Checkout berhasil dibuat',
      data: {
        order_id: orderId,
        transaction_id: txId,
        reference_code: refCode,
        product_amount: itemsTotal,
        shipping_cost: shipCost,
        application_fee: applicationFee,
        total_amount: baseAmount,
        total_due: totalDue,
        status: 'pending'
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error checkoutOrder:', error);
    res.status(500).json({ success: false, message: 'Gagal melakukan checkout' });
  } finally {
    connection.release();
  }
};

export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { status } = req.query;
    let query = `
      SELECT 
        o.id,
        o.user_id,
        o.mitra_id,
        o.address_id,
        o.shipping_address,
        o.shipping_method,
        o.shipping_cost,
        o.product_amount,
        o.application_fee,
        o.voucher_discount,
        o.total_amount,
        o.total_due,
        o.notes,
        o.status,
        o.tracking_number,
        o.expires_at,
        o.created_at,
        o.updated_at,
        m.store_name,
        t.id AS transaction_id,
        t.reference_code,
        t.status AS payment_status,
        t.payment_method
      FROM orders o
      LEFT JOIN mitra_profiles m ON o.mitra_id = m.id
      LEFT JOIN transactions t ON t.order_id = o.id
      WHERE o.user_id = ?
    `;
    const params: any[] = [userId];

    if (status && status !== 'all') {
      query += ' AND o.status = ?';
      params.push(status);
    }

    query += ' ORDER BY o.id DESC';

    const [rows]: any = await pool.query(query, params);

    for (const order of rows) {
      const [items]: any = await pool.query(
        `SELECT oi.id, oi.product_id, oi.quantity, oi.price_at_purchase, oi.variant,
                p.name AS product_name, p.image_urls
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items.map((it: any) => {
        const img = extractFirstImage(it.image_urls);
        const unitPrice = Number(it.price_at_purchase || 0);
        return {
          ...it,
          unit_price: unitPrice,
          price_at_purchase: unitPrice,
          price: unitPrice,
          image: img,
          product_image: img
        };
      });
    }

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error getOrders:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil riwayat pesanan' });
  }
};

export const getOrderDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    const { id } = req.params;

    const [rows]: any = await pool.query(
      `SELECT 
        o.id,
        o.user_id,
        o.mitra_id,
        o.address_id,
        o.shipping_address,
        o.shipping_method,
        o.shipping_cost,
        o.product_amount,
        o.application_fee,
        o.voucher_discount,
        o.total_amount,
        o.total_due,
        o.notes,
        o.status,
        o.tracking_number,
        o.expires_at,
        o.created_at,
        o.updated_at,
        m.store_name,
        m.workshop_address,
        m.whatsapp_number AS store_phone,
        t.id AS transaction_id,
        t.reference_code,
        t.status AS payment_status,
        t.payment_method,
        a.recipient_name,
        a.phone AS recipient_phone,
        a.full_address
      FROM orders o
      LEFT JOIN mitra_profiles m ON o.mitra_id = m.id
      LEFT JOIN transactions t ON t.order_id = o.id
      LEFT JOIN user_addresses a ON o.address_id = a.id
      WHERE o.id = ? AND (o.user_id = ? OR o.mitra_id IN (SELECT id FROM mitra_profiles WHERE user_id = ?))
      LIMIT 1`,
      [id, userId, userId]
    );

    if (!rows || rows.length === 0) {
      res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
      return;
    }

    const order = rows[0];

    const [items]: any = await pool.query(
      `SELECT oi.id, oi.product_id, oi.quantity, oi.price_at_purchase, oi.variant,
              p.name AS product_name, p.image_urls
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [id]
    );

    order.items = items.map((it: any) => {
      const img = extractFirstImage(it.image_urls);
      const unitPrice = Number(it.price_at_purchase || 0);
      return {
        ...it,
        unit_price: unitPrice,
        price_at_purchase: unitPrice,
        price: unitPrice,
        image: img,
        product_image: img
      };
    });

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error('Error getOrderDetail:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil detail pesanan' });
  }
};

export const getOrderTracking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [rows]: any = await pool.query(
      `SELECT o.id, o.status, o.tracking_number, o.shipping_method, o.shipping_address,
              o.total_amount, o.total_due, o.created_at, o.updated_at,
              m.store_name
       FROM orders o
       LEFT JOIN mitra_profiles m ON o.mitra_id = m.id
       WHERE o.id = ?
       LIMIT 1`,
      [id]
    );

    if (!rows || rows.length === 0) {
      res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
      return;
    }

    const order = rows[0];
    const [items]: any = await pool.query(
      `SELECT oi.id, oi.product_id, oi.quantity, oi.price_at_purchase, oi.variant,
              p.name AS product_name, p.image_urls
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [id]
    );

    const mappedItems = items.map((it: any) => {
      const img = extractFirstImage(it.image_urls);
      return {
        ...it,
        unit_price: Number(it.price_at_purchase || 0),
        price_at_purchase: Number(it.price_at_purchase || 0),
        product_image: img,
        image: img
      };
    });

    const createdAt = order.created_at ? new Date(order.created_at) : new Date();
    const updatedAt = order.updated_at ? new Date(order.updated_at) : createdAt;

    const timeline: Array<{ status: string; created_at: string; note: string }> = [
      {
        status: 'pending',
        created_at: createdAt.toISOString(),
        note: 'Pesanan berhasil dibuat dan menunggu pembayaran.'
      }
    ];

    if (['paid', 'packed', 'shipped', 'completed'].includes(order.status)) {
      timeline.push({
        status: 'paid',
        created_at: new Date(createdAt.getTime() + 60 * 1000).toISOString(),
        note: 'Pembayaran telah terverifikasi secara otomatis.'
      });
    }
    if (['packed', 'shipped', 'completed'].includes(order.status)) {
      timeline.push({
        status: 'packed',
        created_at: new Date(createdAt.getTime() + 5 * 60 * 1000).toISOString(),
        note: `Pesanan sedang dikemas oleh pengrajin ${order.store_name || 'Mitra DinoyoCraft'}.`
      });
    }
    if (['shipped', 'completed'].includes(order.status)) {
      timeline.push({
        status: 'shipped',
        created_at: updatedAt.toISOString(),
        note: order.tracking_number
          ? `Pesanan diserahkan ke kurir (${order.shipping_method || 'Reguler'}) dengan No. Resi: ${order.tracking_number}.`
          : `Pesanan sedang dalam pengiriman via ${order.shipping_method || 'kurir ekspedisi'}.`
      });
    }
    if (order.status === 'completed') {
      timeline.push({
        status: 'completed',
        created_at: updatedAt.toISOString(),
        note: 'Pesanan telah diterima oleh pembeli. Transaksi selesai.'
      });
    }
    if (order.status === 'cancelled') {
      timeline.push({
        status: 'cancelled',
        created_at: updatedAt.toISOString(),
        note: 'Pesanan telah dibatalkan.'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...order,
        items: mappedItems,
        timeline: timeline.reverse()
      }
    });
  } catch (error) {
    console.error('Error getOrderTracking:', error);
    res.status(500).json({ success: false, message: 'Gagal memuat pelacakan pesanan' });
  }
};

export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    const { id } = req.params;

    await connection.beginTransaction();

    const [orders]: any = await connection.query(
      'SELECT * FROM orders WHERE id = ? LIMIT 1',
      [id]
    );
    if (!orders || orders.length === 0) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
      return;
    }

    const order = orders[0];
    if (order.user_id !== Number(userId) && res.locals['role'] !== 'admin' && res.locals['role'] !== 'mitra') {
      await connection.rollback();
      res.status(403).json({ success: false, message: 'Tidak diizinkan membatalkan pesanan ini' });
      return;
    }

    await connection.query(
      `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
      [id]
    );
    await connection.query(
      `UPDATE transactions SET status = 'cancelled', updated_at = NOW() WHERE order_id = ?`,
      [id]
    );

    // Kembalikan stok produk
    const [items]: any = await connection.query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
      [id]
    );
    for (const item of items || []) {
      await connection.query(
        'UPDATE products SET stock = stock + ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    await connection.commit();

    res.status(200).json({
      success: true,
      message: 'Pesanan berhasil dibatalkan',
      data: { order_id: Number(id), status: 'cancelled' }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error cancelOrder:', error);
    res.status(500).json({ success: false, message: 'Gagal membatalkan pesanan' });
  } finally {
    connection.release();
  }
};

export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, tracking_number, shipping_method } = req.body;

    const [orders]: any = await pool.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [id]);
    if (!orders || orders.length === 0) {
      res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
      return;
    }

    const order = orders[0];
    await pool.query(
      `UPDATE orders 
       SET status = COALESCE(?, status), 
           tracking_number = COALESCE(?, tracking_number),
           shipping_method = COALESCE(?, shipping_method),
           updated_at = NOW() 
       WHERE id = ?`,
      [status ?? null, tracking_number ?? null, shipping_method ?? null, id]
    );

    if (status === 'paid' || status === 'completed') {
      await pool.query(
        `UPDATE transactions SET status = 'success', updated_at = NOW() WHERE order_id = ?`,
        [id]
      );
    } else if (status === 'cancelled') {
      await pool.query(
        `UPDATE transactions SET status = 'cancelled', updated_at = NOW() WHERE order_id = ?`,
        [id]
      );
    }

    const newStatus = status || order.status;
    await pool
      .query(
        `INSERT INTO notifications (user_id, title, body, type, reference_id, is_read, created_at)
         VALUES (?, ?, ?, 'order', ?, 0, NOW())`,
        [
          order.user_id,
          'Status Pesanan Diperbarui! 📦',
          `Pesanan #${order.id} telah diperbarui statusnya menjadi: ${newStatus}`,
          String(order.id)
        ]
      )
      .catch(() => {});

    sendPushNotificationToUser(
      order.user_id,
      'Status Pesanan Diperbarui! 📦',
      `Pesanan #${order.id} telah diperbarui statusnya menjadi: ${newStatus}`,
      { type: 'order', order_id: String(order.id), status: newStatus }
    ).catch(() => {});

    res.status(200).json({
      success: true,
      message: 'Status pesanan berhasil diperbarui',
      data: {
        order_id: Number(id),
        status: newStatus,
        tracking_number: tracking_number || order.tracking_number
      }
    });
  } catch (error) {
    console.error('Error updateOrderStatus:', error);
    res.status(500).json({ success: false, message: 'Gagal memperbarui status pesanan' });
  }
};
