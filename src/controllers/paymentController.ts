// ============================================================
//  src/controllers/paymentController.ts
//  Controller Pembayaran Midtrans Core API (PRD_Midtrans_Sandbox §5.2)
// ============================================================

import { Request, Response } from 'express';
import { verifySignatureKey } from '../services/midtransService.js';
import {
  applyMidtransStatus,
  cancelOrderPayment,
  checkAndSyncOrderPayment,
  createOrUpdateCharge,
  getPaymentMethodsPayload,
  getSandboxSimulatorPage,
  simulateOrderPaid,
} from '../services/paymentGatewayService.js';
import { findTransactionByRef } from '../services/orderSettlement.js';
import { sendBadRequest, sendError, sendSuccess } from '../utils/response.js';

/** GET /api/payments/methods — Daftar metode Midtrans aktif & konfigurasi biaya layanan. */
export const getMethods = async (_req: Request, res: Response): Promise<void> => {
  sendSuccess(res, getPaymentMethodsPayload(), 'Daftar metode pembayaran berhasil diambil.');
};

/** POST /api/payments/create — Buat atau ambil ulang tagihan Midtrans untuk satu order. */
export const createOrderPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Number(res.locals['userId']);
    const role = String(res.locals['role'] || 'user');
    const orderId = Number(req.body?.order_id);
    const paymentMethod = String(req.body?.payment_method || 'qris').trim();

    if (!Number.isInteger(orderId) || orderId <= 0) {
      sendBadRequest(res, 'ID pesanan tidak valid.');
      return;
    }

    const result = await createOrUpdateCharge(userId, role, orderId, paymentMethod);
    const host = req.get('host');
    if (
      typeof result['deeplink_url'] === 'string' &&
      result['deeplink_url'].startsWith('/') &&
      host
    ) {
      const origin = `${req.protocol}://${host}`;
      result['deeplink_url'] = `${origin}${result['deeplink_url']}`;
      result['payment_url'] = result['deeplink_url'];
    }
    sendSuccess(
      res,
      result,
      result.reused
        ? 'Sesi pembayaran aktif berhasil dimuat ulang.'
        : 'Tagihan pembayaran Midtrans berhasil dibuat.'
    );
  } catch (err: any) {
    const status = Number(err?.status || 500);
    if (status >= 500) {
      console.error('❌ [createOrderPayment] Error:', err);
    }
    sendError(res, err?.message || 'Gagal membuat transaksi pembayaran.', status);
  }
};

/** GET /api/payments/status/:orderId — Status pembayaran terkini (sinkron Midtrans bila pending). */
export const checkOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Number(res.locals['userId']);
    const role = String(res.locals['role'] || 'user');
    const orderId = Number(req.params['orderId']);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      sendBadRequest(res, 'ID pesanan tidak valid.');
      return;
    }

    const result = await checkAndSyncOrderPayment(userId, role, orderId);
    sendSuccess(res, result, 'Status pembayaran berhasil diperbarui.');
  } catch (err: any) {
    const status = Number(err?.status || 500);
    if (status >= 500) {
      console.error('❌ [checkOrderStatus] Error:', err);
    }
    sendError(res, err?.message || 'Gagal memeriksa status pembayaran.', status);
  }
};

/** POST /api/payments/cancel/:orderId — Batalkan tagihan Midtrans dan batalkan pesanan. */
export const cancelPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Number(res.locals['userId']);
    const role = String(res.locals['role'] || 'user');
    const orderId = Number(req.params['orderId']);
    const reason =
      typeof req.body?.reason === 'string' && req.body.reason.trim()
        ? req.body.reason.trim()
        : 'Dibatalkan oleh pembeli';

    if (!Number.isInteger(orderId) || orderId <= 0) {
      sendBadRequest(res, 'ID pesanan tidak valid.');
      return;
    }

    const result = await cancelOrderPayment(userId, role, orderId, reason);
    sendSuccess(res, result, 'Pembayaran dan pesanan berhasil dibatalkan.');
  } catch (err: any) {
    const status = Number(err?.status || 500);
    if (status >= 500) {
      console.error('❌ [cancelPayment] Error:', err);
    }
    sendError(res, err?.message || 'Gagal membatalkan pembayaran.', status);
  }
};

/** POST /api/payments/webhook — HTTP Notification dari Midtrans + verifikasi SHA512 signature_key. */
export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      transaction_status: transactionStatus,
      fraud_status: fraudStatus,
      transaction_id: transactionId,
    } = req.body ?? {};

    if (!orderId || !statusCode || grossAmount === undefined || !signatureKey) {
      res.status(400).json({
        success: false,
        message: 'Payload notifikasi Midtrans tidak lengkap.',
      });
      return;
    }

    const validSignature = verifySignatureKey(
      String(orderId),
      String(statusCode),
      String(grossAmount),
      String(signatureKey)
    );

    if (!validSignature) {
      console.warn(`⚠️ [Midtrans Webhook] Signature tidak valid untuk order_id=${orderId}`);
      res.status(403).json({
        success: false,
        message: 'Signature notifikasi Midtrans tidak valid.',
      });
      return;
    }

    const trx = await findTransactionByRef(
      String(orderId),
      transactionId ? String(transactionId) : undefined
    );

    if (!trx) {
      console.warn(`⚠️ [Midtrans Webhook] Transaksi tidak ditemukan untuk order_id=${orderId}`);
      // Balas 200 supaya Midtrans tidak retry terus (mis. test notification / orphan sandbox order)
      res.status(200).json({
        success: true,
        message: 'Notifikasi diterima (transaksi lokal tidak ditemukan).',
      });
      return;
    }

    const mappedStatus = await applyMidtransStatus(
      trx,
      String(transactionStatus || ''),
      fraudStatus ? String(fraudStatus) : null,
      String(grossAmount),
      req.body
    );

    console.log(
      `📩 [Midtrans Webhook] order_id=${orderId} (${transactionStatus}) → ${mappedStatus}`
    );

    res.status(200).json({
      success: true,
      message: 'Notifikasi Midtrans berhasil diproses.',
      status: mappedStatus,
    });
  } catch (err: any) {
    const status = Number(err?.status || 500);
    console.error('❌ [Midtrans Webhook] Error:', err?.message || err);
    res.status(status).json({
      success: false,
      message: err?.message || 'Gagal memproses notifikasi Midtrans.',
    });
  }
};

/** POST /api/payments/simulate-paid/:orderId — Shortcut Sandbox only (otomatis mati di Production). */
export const simulatePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Number(res.locals['userId']);
    const role = String(res.locals['role'] || 'user');
    const orderId = Number(req.params['orderId']);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      sendBadRequest(res, 'ID pesanan tidak valid.');
      return;
    }

    const result = await simulateOrderPaid(userId, role, orderId);
    sendSuccess(res, result, 'Simulasi pembayaran Sandbox berhasil ditandai lunas.');
  } catch (err: any) {
    const status = Number(err?.status || 500);
    if (status >= 500) {
      console.error('❌ [simulatePayment] Error:', err);
    }
    sendError(res, err?.message || 'Gagal menjalankan simulasi pembayaran.', status);
  }
};

/** GET /api/payments/sandbox-simulator/:orderId — Redirect auto-POST ke Midtrans Simulator Sandbox (VA/QRIS). */
export const openSandboxSimulator = async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = Number(req.params['orderId']);
    const ref = String(req.query['ref'] || '').trim();
    const sig = String(req.query['sig'] || '').trim();

    if (!Number.isInteger(orderId) || orderId <= 0) {
      res.status(400).type('text/plain').send('ID pesanan tidak valid.');
      return;
    }

    const page = await getSandboxSimulatorPage(orderId, ref, sig);
    if (page.redirectUrl) {
      res.redirect(page.redirectUrl);
      return;
    }

    // Izinkan form auto-submit lintas origin khusus menuju simulator Sandbox Midtrans
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'unsafe-inline'; form-action https://simulator.sandbox.midtrans.com; style-src 'unsafe-inline'"
    );
    res.status(page.status).type('html').send(page.html);
  } catch (err: any) {
    console.error('❌ [openSandboxSimulator] Error:', err);
    res.status(500).type('text/plain').send('Gagal membuka halaman simulator Midtrans.');
  }
};
