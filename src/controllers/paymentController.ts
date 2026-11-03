// ============================================================
//  src/controllers/paymentController.ts
//  Controller Payment Gateway (SociaBuzz via scbz sidecar)
// ============================================================

import { Request, Response } from 'express';
import crypto from 'crypto';
import pool from '../config/database.js';
import {
  sendSuccess,
  sendBadRequest,
  sendNotFound,
  sendForbidden,
  sendError,
} from '../utils/response.js';
import * as paymentService from '../services/paymentService.js';
import { settleOrderPaid, findTransactionByRef } from '../services/orderSettlement.js';

// ------------------------------------------------------------
// 1. Ambil Daftar Negara yang Didukung Gateway
// ------------------------------------------------------------
export const getCountries = async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await paymentService.getPaymentCountries();
    sendSuccess(res, data, 'Daftar negara berhasil diambil.');
  } catch (error: any) {
    sendError(res, error.message || 'Gagal mengambil daftar negara dari payment gateway.', error.status || 502);
  }
};

// ------------------------------------------------------------
// 2. Estimasi Biaya (Fee) Pembayaran
// ------------------------------------------------------------
export const getFees = async (req: Request, res: Response): Promise<void> => {
  try {
    const { country = 'Indonesia', amount, username } = req.body;
    const data = await paymentService.calculatePaymentFees(country, Number(amount), username);
    sendSuccess(res, data, 'Estimasi biaya berhasil dihitung.');
  } catch (error: any) {
    sendError(res, error.message || 'Gagal menghitung biaya pembayaran.', error.status || 502);
  }
};

// ------------------------------------------------------------
// 3. Ambil Metode Pembayaran Berdasarkan Token Sesi
// ------------------------------------------------------------
export const getMethods = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    if (!token) {
      sendBadRequest(res, 'Token sesi pembayaran wajib diisi.');
      return;
    }
    const data = await paymentService.fetchPaymentMethods(token);
    sendSuccess(res, data, 'Metode pembayaran tersedia berhasil diambil.');
  } catch (error: any) {
    sendError(res, error.message || 'Gagal mengambil metode pembayaran.', error.status || 502);
  }
};

// ------------------------------------------------------------
// 4. Buat Pembayaran untuk Pesanan (Order)
//    Menghasilkan QRIS / Link Pembayaran untuk Mobile App & Web
// ------------------------------------------------------------
export const createOrderPayment = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    const userId = res.locals['userId'];
    const userRole = res.locals['role'];
    const { order_id, payment_method = 'qris' } = req.body;

    // 1. Ambil detail order, transaksi, dan user
    const [orders]: any = await connection.query(
      `SELECT o.id, o.user_id, o.total_amount, o.status AS order_status,
              t.id AS transaction_id, t.reference_code, t.status AS transaction_status,
              t.payment_token, t.inv_id, t.payment_url, t.qr_string,
              u.name AS user_name, u.email AS user_email
       FROM orders o
       JOIN transactions t ON o.transaction_id = t.id
       JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [order_id]
    );

    if (orders.length === 0) {
      sendNotFound(res, `Pesanan #${order_id} tidak ditemukan.`);
      return;
    }

    const order = orders[0];

    // 2. Otorisasi kepemilikan pesanan
    if (order.user_id !== userId && userRole !== 'admin') {
      sendForbidden(res, 'Anda tidak berhak membuat pembayaran untuk pesanan ini.');
      return;
    }

    // 3. Validasi status
    if (order.order_status === 'paid' || order.transaction_status === 'success') {
      sendBadRequest(res, 'Pesanan ini sudah dibayar.');
      return;
    }

    if (order.order_status === 'cancelled') {
      sendBadRequest(res, 'Pesanan ini telah dibatalkan.');
      return;
    }

    // 4. Siapkan URL Webhook untuk callback dari gateway scbz
    const host = req.get('host') || '127.0.0.1:5000';
    const protocol = req.protocol || 'http';
    const callbackUrl = `${protocol}://${host}/api/payments/webhook`;

    // 5. Hitung Biaya Layanan agar nominal di SociaBuzz menutup potongan fee & biaya penarikan
    const baseOrderAmount = Number(order.total_amount);
    const serviceFeeCalc = paymentService.calculateServiceFee(baseOrderAmount);
    const totalAmountToCharge = serviceFeeCalc.finalAmountToPay;

    // 6. Buat pembayaran (Native 100% Vercel dengan fallback)
    let paymentResult: any;
    try {
      paymentResult = await paymentService.processDirectPayment({
        amount: totalAmountToCharge,
        fullname: order.user_name,
        email: order.user_email,
        note: `Order #${order.id} - ${order.reference_code}`,
        paymentMethod: payment_method,
      });
    } catch (directErr: any) {
      console.warn('⚠️ [processDirectPayment] Fallback ke createDonationSession:', directErr.message);
      const session: any = await paymentService.createDonationSession({
        amount: totalAmountToCharge,
        fullname: order.user_name,
        email: order.user_email,
        note: `Order #${order.id} - ${order.reference_code}`,
        callback_url: callbackUrl,
      });
      paymentResult = await paymentService.initiatePayment(session.token, payment_method);
    }

    const sessionToken = paymentResult.token;

    // 7. Simpan token, inv_id, qr_string, dan url pembayaran ke transaksi di database
    await connection.query(
      `UPDATE transactions SET
         transaction_type = ?,
         payment_token = ?,
         inv_id = ?,
         payment_url = ?,
         qr_string = ?,
         gateway_fee = ?
       WHERE id = ?`,
      [
        paymentResult.payment_method || payment_method,
        sessionToken,
        paymentResult.inv_id || null,
        paymentResult.payment_url || null,
        paymentResult.qr_string || null,
        serviceFeeCalc.totalServiceFee,
        order.transaction_id,
      ]
    );

    // Nominal resmi = yang tercantum di QR/tagihan gateway
    // (nilai pesanan + biaya layanan platform + fee channel QRIS).
    const gatewayTotalPay = Number(paymentResult.fee?.total_pay || totalAmountToCharge);

    sendSuccess(
      res,
      {
        order_id: order.id,
        transaction_id: order.transaction_id,
        reference_code: order.reference_code,
        payment_method: paymentResult.payment_method || payment_method,
        label: paymentResult.label || 'Pembayaran',
        base_amount: baseOrderAmount,
        service_fee: serviceFeeCalc.totalServiceFee,
        service_fee_details: {
          fixed: serviceFeeCalc.fixedFee,
          percent: serviceFeeCalc.percentFee,
        },
        channel_fee: Number(paymentResult.fee?.total_fee || 0),
        amount: gatewayTotalPay,
        fee: paymentResult.fee,
        total_pay: gatewayTotalPay,
        payment_url: paymentResult.payment_url || null,
        qr_string: paymentResult.qr_string || null,
        token: sessionToken,
        inv_id: paymentResult.inv_id || null,
        payment_status: 'pending',
      },
      'Instruksi pembayaran berhasil dibuat.'
    );
  } catch (error: any) {
    console.error('❌ [createOrderPayment] Error:', error);
    sendError(res, error.message || 'Gagal membuat pembayaran.', error.status || 500);
  } finally {
    connection.release();
  }
};

// ------------------------------------------------------------
// 5. Cek Status Pembayaran Pesanan (Polling dari Mobile/Frontend)
// ------------------------------------------------------------
export const checkOrderStatus = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    const userId = res.locals['userId'];
    const userRole = res.locals['role'];
    const orderId = Number(req.params['orderId']);

    if (!orderId || isNaN(orderId)) {
      sendBadRequest(res, 'ID pesanan tidak valid.');
      return;
    }

    const [orders]: any = await connection.query(
      `SELECT o.id, o.user_id, o.mitra_id, o.status AS order_status, o.total_amount,
              t.id AS transaction_id, t.transaction_type, t.reference_code,
              t.status AS transaction_status, t.payment_token, t.inv_id,
              t.payment_url, t.qr_string,
              m.user_id AS mitra_user_id, m.store_name
       FROM orders o
       JOIN transactions t ON o.transaction_id = t.id
       JOIN mitra_profiles m ON o.mitra_id = m.id
       WHERE o.id = ?`,
      [orderId]
    );

    if (orders.length === 0) {
      sendNotFound(res, `Pesanan #${orderId} tidak ditemukan.`);
      return;
    }

    const order = orders[0];

    // Otorisasi: pemilik pesanan, mitra terkait, atau admin
    if (order.user_id !== userId && order.mitra_user_id !== userId && userRole !== 'admin') {
      sendForbidden(res, 'Anda tidak berhak melihat status pembayaran pesanan ini.');
      return;
    }

    // Jika sudah lunas di DB, langsung kembalikan 'paid'
    if (order.order_status === 'paid' || order.transaction_status === 'success') {
      sendSuccess(res, {
        order_id: order.id,
        transaction_status: 'success',
        order_status: 'paid',
        payment_status: 'paid',
      });
      return;
    }

    // Jika ada token dan inv_id, tanyakan ke gateway scbz secara real-time
    let liveStatus = 'pending';
    if (order.payment_token && order.transaction_type) {
      try {
        const checkResult: any = await paymentService.verifyPaymentStatus(
          order.payment_token,
          order.transaction_type,
          order.inv_id || order.payment_token
        );
        liveStatus = checkResult.status || 'pending';
      } catch (err: any) {
        console.warn('⚠️ [checkOrderStatus] Gagal menghubungi scbz:', err.message);
      }
    }

    // Jika scbz melaporkan status 'paid', perbarui database secara otomatis
    if (liveStatus === 'paid' && order.order_status !== 'paid') {
      await settleOrderPaid({
        id: order.transaction_id,
        order_id: order.id,
        user_id: order.user_id,
        mitra_user_id: order.mitra_user_id,
        total_amount: order.total_amount,
      });

      sendSuccess(res, {
        order_id: order.id,
        transaction_status: 'success',
        order_status: 'paid',
        payment_status: 'paid',
      }, 'Pembayaran telah terverifikasi lunas!');
      return;
    }

    sendSuccess(res, {
      order_id: order.id,
      transaction_status: order.transaction_status,
      order_status: order.order_status,
      payment_status: liveStatus,
    });
  } catch (error: any) {
    await connection.rollback().catch(() => {});
    console.error('❌ [checkOrderStatus] Error:', error);
    sendError(res, 'Gagal memeriksa status pembayaran.');
  } finally {
    connection.release();
  }
};

// ------------------------------------------------------------
// 6. Webhook Callback Endpoint (Dipanggil oleh scbz dispatcher)
// ------------------------------------------------------------
export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    const webhookSecret = process.env['WEBHOOK_SECRET'];
    if (webhookSecret) {
      const incomingSecret = req.headers['x-webhook-secret'];
      const incomingSignature = req.headers['x-webhook-signature'];

      if (incomingSecret && incomingSecret !== webhookSecret) {
        sendForbidden(res, 'Webhook secret tidak valid.');
        return;
      }

      if (incomingSignature) {
        const rawBody = JSON.stringify(req.body);
        const expectedSig = crypto
          .createHmac('sha256', webhookSecret)
          .update(rawBody)
          .digest('hex');
        if (incomingSignature !== expectedSig) {
          sendForbidden(res, 'Webhook signature tidak valid.');
          return;
        }
      }
    }

    const { event, token, inv_id, status } = req.body;
    console.log(`🔔 [Webhook Payment] Diterima: event=${event}, token=${token}, inv_id=${inv_id}, status=${status}`);

    if (status === 'paid' || event === 'payment.paid') {
      // Temukan transaksi berdasarkan token atau inv_id, lalu tandai lunas
      // (idempoten — aman dipanggil ulang).
      const trx = await findTransactionByRef(inv_id, token);
      if (trx) {
        const settled = await settleOrderPaid(trx);
        if (settled) {
          console.log(`✅ [Webhook Payment] Pesanan #${trx.order_id} ditandai 'paid'.`);
        }
      }
    }

    sendSuccess(res, { received: true }, 'Webhook berhasil diproses.');
  } catch (error: any) {
    await connection.rollback().catch(() => {});
    console.error('❌ [handleWebhook] Error:', error);
    sendError(res, 'Gagal memproses webhook pembayaran.');
  } finally {
    connection.release();
  }
};



// Aliases agar kompatibel dengan pemanggilan fungsi versi alternatif
export const getPaymentMethods = getMethods;
export const createPayment = createOrderPayment;
export const getPaymentStatus = checkOrderStatus;


// ------------------------------------------------------------
// 7. SIMULASI PEMBAYARAN (DEV/DEMO ONLY)
//    Menandai pesanan lunas TANPA uang asli — untuk menguji alur
//    checkout → saldo mitra saat presentasi. Dimatikan di production.
// ------------------------------------------------------------
export const simulatePayment = async (req: Request, res: Response): Promise<void> => {
  if (process.env['NODE_ENV'] === 'production') {
    sendForbidden(res, 'Endpoint simulasi hanya tersedia di lingkungan development.');
    return;
  }

  const connection = await pool.getConnection();
  try {
    const userId = res.locals['userId'];
    const userRole = res.locals['role'];
    const orderId = Number((req.params as { orderId: string }).orderId);

    const [orders]: any = await connection.query(
      `SELECT o.id, o.user_id, o.total_amount, o.status AS order_status,
              t.id AS transaction_id, t.status AS transaction_status,
              m.user_id AS mitra_user_id
       FROM orders o
       JOIN transactions t ON o.transaction_id = t.id
       JOIN mitra_profiles m ON o.mitra_id = m.id
       WHERE o.id = ?`,
      [orderId]
    );

    if (orders.length === 0) {
      sendNotFound(res, `Pesanan #${orderId} tidak ditemukan.`);
      return;
    }
    const order = orders[0];

    if (order.user_id !== userId && order.mitra_user_id !== userId && userRole !== 'admin') {
      sendForbidden(res, 'Anda tidak berhak mensimulasi pembayaran pesanan ini.');
      return;
    }
    if (order.order_status === 'paid' || order.transaction_status === 'success') {
      sendBadRequest(res, 'Pesanan ini sudah lunas.');
      return;
    }

    const settled = await settleOrderPaid({
      id: order.transaction_id,
      order_id: order.id,
      user_id: order.user_id,
      mitra_user_id: order.mitra_user_id,
      total_amount: order.total_amount,
    });

    sendSuccess(res, {
      order_id: order.id,
      simulated: true,
      settled,
      note: 'Pembayaran disimulasikan — gunakan PATCH /api/orders/:id/status (status: completed) untuk menandai pesanan selesai sehingga masuk saldo mitra.',
    }, 'Pembayaran (simulasi) berhasil — pesanan kini berstatus PAID.');
  } catch (error: any) {
    sendError(res, error.message || 'Gagal mensimulasikan pembayaran.', error.status || 500);
  } finally {
    connection.release();
  }
};
