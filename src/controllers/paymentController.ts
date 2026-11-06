import { Request, Response } from 'express';
import pool from '../config/database.js';
import { sendPushNotificationToUser } from '../services/notificationService.js';

export const getPaymentMethods = async (_req: Request, res: Response): Promise<void> => {
  const methods = [
    {
      id: 'qris',
      name: 'QRIS Real-Time',
      category: 'qris',
      icon_url: '/assets/icons/payment/qris.svg',
      description: 'Bayar instan via GoPay, OVO, Dana, ShopeePay, BCA, dll.'
    },
    {
      id: 'bca_va',
      name: 'BCA Virtual Account',
      category: 'va',
      icon_url: '/assets/icons/payment/bca.svg',
      description: 'Transfer via ATM atau Mobile Banking BCA'
    },
    {
      id: 'bri_va',
      name: 'BRI Virtual Account',
      category: 'va',
      icon_url: '/assets/icons/payment/bri.svg',
      description: 'Transfer via BRImo atau ATM BRI'
    },
    {
      id: 'mandiri_va',
      name: 'Mandiri Virtual Account',
      category: 'va',
      icon_url: '/assets/icons/payment/mandiri.svg',
      description: 'Transfer via Livin by Mandiri'
    }
  ];

  res.status(200).json({
    success: true,
    data: { methods }
  });
};

export const createPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { order_id, payment_method = 'qris' } = req.body;

    if (!order_id) {
      res.status(400).json({ success: false, message: 'order_id wajib diisi' });
      return;
    }

    const [orders]: any = await pool.query(
      `SELECT o.id, o.user_id, o.mitra_id, o.total_amount, o.total_due, o.application_fee, o.status,
              t.id AS transaction_id, t.reference_code, t.status AS payment_status
       FROM orders o
       LEFT JOIN transactions t ON t.order_id = o.id
       WHERE o.id = ?
       ORDER BY t.id DESC
       LIMIT 1`,
      [order_id]
    );

    if (!orders || orders.length === 0) {
      res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
      return;
    }

    const order = orders[0];
    const baseAmount = Number(order.total_amount || 0);
    const serviceFee = Number(order.application_fee || 0);
    const totalPay = Number(order.total_due || baseAmount + serviceFee);
    const refCode = order.reference_code || `TRX-${order.id}-${Date.now()}`;

    const qrisString = `00020101021226670016ID.CO.SOCIABUZZ.WWW01189360091800000000010215${refCode}520458125303360540${totalPay}.005802ID5910DINOYOCRAFT6006MALANG62070703A016304`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrisString)}`;

    if (order.transaction_id) {
      await pool
        .query(
          `UPDATE transactions SET qr_string = ?, payment_method = ?, updated_at = NOW() WHERE id = ?`,
          [qrisString, payment_method, order.transaction_id]
        )
        .catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: 'Pembayaran berhasil diinisiasi',
      data: {
        order_id: Number(order_id),
        transaction_id: Number(order.transaction_id || 0),
        reference_code: refCode,
        payment_method,
        label: String(payment_method).toUpperCase(),
        amount: totalPay,
        base_amount: baseAmount,
        service_fee: serviceFee,
        total_pay: totalPay,
        qr_string: qrisString,
        qris_string: qrisString,
        qr_image_url: qrImageUrl,
        payment_status: order.payment_status || 'pending',
        status: order.payment_status || 'pending',
        expiry_time: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      }
    });
  } catch (error) {
    console.error('Error createPayment:', error);
    res.status(500).json({ success: false, message: 'Gagal membuat tagihan pembayaran' });
  }
};

export const getPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;

    const [orders]: any = await pool.query(
      `SELECT o.id, o.status AS order_status, o.total_amount, o.total_due,
              t.status AS payment_status, t.reference_code
       FROM orders o
       LEFT JOIN transactions t ON t.order_id = o.id
       WHERE o.id = ?
       ORDER BY t.id DESC
       LIMIT 1`,
      [orderId]
    );

    if (!orders || orders.length === 0) {
      res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
      return;
    }

    const order = orders[0];
    res.status(200).json({
      success: true,
      data: {
        order_id: Number(orderId),
        reference_code: order.reference_code,
        status: order.order_status,
        payment_status: order.payment_status || order.order_status,
        order_status: order.order_status,
        is_paid: order.order_status !== 'pending' && order.payment_status === 'success'
      }
    });
  } catch (error) {
    console.error('Error getPaymentStatus:', error);
    res.status(500).json({ success: false, message: 'Gagal memeriksa status pembayaran' });
  }
};

export const confirmPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;

    const [orders]: any = await pool.query(
      `SELECT o.id, o.user_id, o.mitra_id, o.status, o.total_due, o.total_amount,
              t.id AS transaction_id, t.reference_code
       FROM orders o
       LEFT JOIN transactions t ON t.order_id = o.id
       WHERE o.id = ?
       ORDER BY t.id DESC
       LIMIT 1`,
      [orderId]
    );

    if (!orders || orders.length === 0) {
      res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
      return;
    }

    const order = orders[0];
    if (order.status === 'pending') {
      await pool.query(
        `UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = ?`,
        [orderId]
      );
    }
    await pool.query(
      `UPDATE transactions SET status = 'success', updated_at = NOW() WHERE order_id = ?`,
      [orderId]
    );

    // Simpan notifikasi ke pembeli & mitra
    await pool
      .query(
        `INSERT INTO notifications (user_id, title, body, type, reference_id, is_read, created_at)
         VALUES (?, ?, ?, 'order', ?, 0, NOW())`,
        [
          order.user_id,
          'Pembayaran Berhasil! ✅',
          `Pembayaran pesanan #${order.id} telah lunas. Pengrajin akan segera mengemas pesanan Anda.`,
          String(order.id)
        ]
      )
      .catch(() => {});

    const [mitraOwner]: any = await pool.query(
      'SELECT user_id FROM mitra_profiles WHERE id = ? LIMIT 1',
      [order.mitra_id]
    );
    if (mitraOwner && mitraOwner.length > 0) {
      await pool
        .query(
          `INSERT INTO notifications (user_id, title, body, type, reference_id, is_read, created_at)
           VALUES (?, ?, ?, 'order', ?, 0, NOW())`,
          [
            mitraOwner[0].user_id,
            'Pesanan Telah Dibayar! 💰',
            `Pesanan #${order.id} telah dibayar lunas. Silakan segera kemas dan kirim pesanan.`,
            String(order.id)
          ]
        )
        .catch(() => {});
    }

    sendPushNotificationToUser(
      order.user_id,
      'Pembayaran Berhasil! ✅',
      `Pembayaran pesanan #${order.id} telah lunas dan diteruskan ke pengrajin.`,
      { type: 'order', order_id: String(order.id), status: 'paid' }
    ).catch(() => {});

    res.status(200).json({
      success: true,
      message: 'Pembayaran berhasil dikonfirmasi',
      data: {
        order_id: Number(orderId),
        status: 'paid',
        payment_status: 'success',
        order_status: 'paid',
        is_paid: true
      }
    });
  } catch (error) {
    console.error('Error confirmPayment:', error);
    res.status(500).json({ success: false, message: 'Gagal mengonfirmasi pembayaran' });
  }
};
