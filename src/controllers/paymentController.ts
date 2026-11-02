import { Request, Response } from 'express';
import pool from '../config/database.js';

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
    data: methods
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
      `SELECT o.id, o.total_amount, o.status, t.id AS transaction_id, t.reference_code
       FROM orders o
       LEFT JOIN transactions t ON o.transaction_id = t.id
       WHERE o.id = ? LIMIT 1`,
      [order_id]
    );

    if (!orders || orders.length === 0) {
      res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
      return;
    }

    const order = orders[0];
    const amount = Number(order.total_amount);
    const refCode = order.reference_code || `TRX-${order.id}-${Date.now()}`;

    // Dummy/Mock QRIS code compliant standard (or gateway response)
    const qrisString = `00020101021226670016ID.CO.SOCIABUZZ.WWW01189360091800000000010215${refCode}520458125303360540${amount}.005802ID5910DINOYOCRAFT6006MALANG62070703A016304`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrisString)}`;

    res.status(200).json({
      success: true,
      message: 'Pembayaran berhasil diinisiasi',
      data: {
        order_id: Number(order_id),
        reference_code: refCode,
        payment_method,
        amount,
        qris_string: qrisString,
        qr_image_url: qrImageUrl,
        expiry_time: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
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
      `SELECT o.id, o.status AS order_status, o.total_amount, t.status AS payment_status, t.reference_code
       FROM orders o
       LEFT JOIN transactions t ON o.transaction_id = t.id
       WHERE o.id = ? LIMIT 1`,
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
        payment_status: order.payment_status || order.order_status,
        order_status: order.order_status,
        is_paid: order.order_status !== 'pending' && order.payment_status === 'success',
      }
    });
  } catch (error) {
    console.error('Error getPaymentStatus:', error);
    res.status(500).json({ success: false, message: 'Gagal memeriksa status pembayaran' });
  }
};

