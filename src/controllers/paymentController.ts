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

const setPaymentLogContext = (
  res: Response,
  opts: {
    eventName: string;
    severity: 'info' | 'success' | 'warning' | 'error' | 'critical';
    outcome: 'pending' | 'success' | 'failure' | 'info';
    message: string;
    orderId?: number | null;
    transactionId?: number | null;
    referenceCode?: string | null;
    source?: 'backend' | 'external';
    service?: string;
    metadata?: Record<string, any>;
    isCriticalError?: boolean;
  }
): void => {
  res.locals['logCategory'] = 'transaction';
  res.locals['logEventName'] = opts.eventName;
  res.locals['logSeverity'] = opts.severity;
  res.locals['logOutcome'] = opts.outcome;
  res.locals['logMessage'] = opts.message;
  res.locals['logSource'] = opts.source ?? 'backend';
  res.locals['logService'] = opts.service ?? 'payment-gateway';
  if (opts.orderId) res.locals['orderId'] = Number(opts.orderId);
  if (opts.transactionId) res.locals['transactionId'] = Number(opts.transactionId);
  if (opts.referenceCode) res.locals['referenceCode'] = String(opts.referenceCode);
  if (opts.metadata) res.locals['logMetadata'] = opts.metadata;
  if (opts.isCriticalError) res.locals['isCriticalError'] = true;
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

    const refCode = result['reference_code'] ? String(result['reference_code']) : null;
    const methodLabel = String(result['payment_method'] || paymentMethod).toUpperCase();
    const paymentStatus = String(result['payment_status'] || 'pending');
    const isPending = paymentStatus === 'pending';

    setPaymentLogContext(res, {
      eventName: isPending ? 'transaction.payment.pending' : `transaction.payment.${paymentStatus}`,
      severity: isPending ? 'info' : paymentStatus === 'paid' ? 'success' : 'warning',
      outcome: isPending ? 'pending' : paymentStatus === 'paid' ? 'success' : 'failure',
      orderId: Number(result['order_id'] ?? orderId),
      transactionId: result['transaction_id'] ? Number(result['transaction_id']) : null,
      referenceCode: refCode,
      message: result.reused
        ? `Tagihan pembayaran ${methodLabel} pesanan #${orderId} masih pending (belum dibayar, Ref: ${refCode || '-'})`
        : `Tagihan pembayaran ${methodLabel} Midtrans dibuat untuk pesanan #${orderId} — status pending menunggu pembayaran (Ref: ${refCode || '-'})`,
      metadata: {
        gateway: 'midtrans',
        gatewayOrderId: result['gateway_order_id'] ?? null,
        paymentMethod: result['payment_method'] ?? paymentMethod,
        paymentType: result['payment_type'] ?? null,
        paymentStatus,
        totalPay: result['total_pay'] ?? null,
        expiryTime: result['expiry_time'] ?? null,
        reused: Boolean(result.reused),
      },
    });

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
    const refCode = result['reference_code'] ? String(result['reference_code']) : null;
    const paymentStatus = String(result['payment_status'] || 'pending');
    const isPending = paymentStatus === 'pending';
    const isPaid = paymentStatus === 'paid';

    setPaymentLogContext(res, {
      eventName: isPending
        ? 'transaction.payment.pending'
        : isPaid
        ? 'transaction.payment.paid'
        : `transaction.payment.${paymentStatus}`,
      severity: isPending ? 'info' : isPaid ? 'success' : 'warning',
      outcome: isPending ? 'pending' : isPaid ? 'success' : 'failure',
      orderId: Number(result['order_id'] ?? orderId),
      transactionId: result['transaction_id'] ? Number(result['transaction_id']) : null,
      referenceCode: refCode,
      message: isPending
        ? `Pengecekan status pembayaran pesanan #${orderId}: masih pending / belum dibayar (Ref: ${refCode || '-'})`
        : isPaid
        ? `Pembayaran pesanan #${orderId} telah lunas (Ref: ${refCode || '-'})`
        : `Status pembayaran pesanan #${orderId} berakhir: ${paymentStatus} (Ref: ${refCode || '-'})`,
      metadata: {
        gateway: result['gateway'] ?? 'midtrans',
        gatewayOrderId: result['gateway_order_id'] ?? null,
        paymentMethod: result['payment_method'] ?? null,
        paymentType: result['payment_type'] ?? null,
        paymentStatus,
        orderStatus: result['order_status'] ?? null,
        totalPay: result['total_pay'] ?? null,
        expiryTime: result['expiry_time'] ?? null,
        paidAt: result['paid_at'] ?? null,
      },
    });

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
    setPaymentLogContext(res, {
      eventName: 'transaction.payment.cancelled',
      severity: 'warning',
      outcome: 'failure',
      orderId: Number(result['order_id'] ?? orderId),
      transactionId: result['transaction_id'] ? Number(result['transaction_id']) : null,
      referenceCode: result['reference_code'] ? String(result['reference_code']) : null,
      message: `Pembayaran pesanan #${orderId} dibatalkan (${reason})`,
      metadata: {
        paymentStatus: 'cancelled',
        orderStatus: result['order_status'] ?? 'cancelled',
        reason,
      },
    });

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
      setPaymentLogContext(res, {
        eventName: 'transaction.webhook.signature_mismatch',
        severity: 'critical',
        outcome: 'failure',
        source: 'external',
        service: 'payment-webhook',
        referenceCode: String(orderId),
        isCriticalError: true,
        message: `CRITICAL: Signature webhook Midtrans tidak valid untuk order_id=${orderId}`,
        metadata: {
          gateway: 'midtrans',
          gatewayOrderId: String(orderId),
          verification: 'rejected',
        },
      });
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
      setPaymentLogContext(res, {
        eventName: 'transaction.webhook.orphan',
        severity: 'info',
        outcome: 'info',
        source: 'external',
        service: 'payment-webhook',
        referenceCode: String(orderId),
        message: `Webhook Midtrans diterima untuk order_id=${orderId} (transaksi lokal tidak ditemukan)`,
        metadata: {
          gateway: 'midtrans',
          gatewayOrderId: String(orderId),
          transactionStatus: transactionStatus ?? null,
        },
      });
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

    const refCode = (trx as any).reference_code ? String((trx as any).reference_code) : String(orderId);
    const isPending = mappedStatus === 'pending';
    const isPaid = mappedStatus === 'paid';

    setPaymentLogContext(res, {
      eventName: isPending
        ? 'transaction.payment.pending'
        : isPaid
        ? 'transaction.payment.paid'
        : `transaction.payment.${mappedStatus}`,
      severity: isPending ? 'info' : isPaid ? 'success' : 'warning',
      outcome: isPending ? 'pending' : isPaid ? 'success' : 'failure',
      source: 'external',
      service: 'payment-webhook',
      orderId: trx.order_id,
      transactionId: trx.id,
      referenceCode: refCode,
      message: isPending
        ? `Webhook Midtrans: pembayaran pesanan #${trx.order_id} berstatus pending / menunggu pembayaran (Ref: ${refCode})`
        : isPaid
        ? `Webhook Midtrans: pembayaran pesanan #${trx.order_id} telah lunas (Ref: ${refCode})`
        : `Webhook Midtrans: pembayaran pesanan #${trx.order_id} berstatus ${mappedStatus} (Ref: ${refCode})`,
      metadata: {
        gateway: 'midtrans',
        gatewayOrderId: String(orderId),
        rawTransactionStatus: transactionStatus ?? null,
        fraudStatus: fraudStatus ?? null,
        mappedStatus,
        grossAmount: String(grossAmount),
      },
    });

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
    setPaymentLogContext(res, {
      eventName: 'transaction.payment.paid',
      severity: 'success',
      outcome: 'success',
      orderId: Number(result['order_id'] ?? orderId),
      transactionId: result['transaction_id'] ? Number(result['transaction_id']) : null,
      referenceCode: result['reference_code'] ? String(result['reference_code']) : null,
      message: `Simulasi pembayaran Sandbox pesanan #${orderId} berhasil ditandai lunas`,
      metadata: {
        gateway: 'midtrans',
        simulated: true,
        paymentStatus: 'paid',
        orderStatus: result['order_status'] ?? 'paid',
      },
    });

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
