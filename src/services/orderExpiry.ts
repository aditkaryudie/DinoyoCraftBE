// ============================================================
//  src/services/orderExpiry.ts
//  Pembatalan / Kedaluwarsa Pesanan Otomatis (PRD_Midtrans_Sandbox §5.3).
//  Mengembalikan stok, menandai transaksi & order, catat riwayat,
//  dan kirim notifikasi DB + Pusher + FCM secara idempoten.
// ============================================================

import pool from '../config/database.js';
import { sendPushNotificationToUser } from './notificationService.js';
import pusher from '../utils/pusher.js';
import { adjustProductStockAndVariant } from '../controllers/productController.js';

export type OrderFailureReason = 'expired' | 'failed' | 'cancelled';

export interface OrderFailureTarget {
  id: number;
  order_id: number;
  user_id: number;
  mitra_user_id: number;
  total_amount: number;
  status?: string;
}

/**
 * Tandai transaksi pending sebagai gagal/expired/dibatalkan secara idempoten:
 * stok dikembalikan, order diubah ke 'cancelled', timeline & notifikasi dicatat.
 *
 * Catatan ENUM DB: kolom `transactions.status` hanya menerima
 * ('pending','success','failed','cancelled'), sehingga `expired` disimpan sebagai
 * `failed` dan detail `internal_reason: 'expired'` ikut dicatat pada `gateway_response`.
 */
export async function cancelOrExpireOrderPayment(
  trx: OrderFailureTarget,
  reasonStatus: OrderFailureReason,
  raw?: unknown
): Promise<boolean> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [current]: any = await connection.query(
      'SELECT status FROM transactions WHERE id = ? FOR UPDATE',
      [trx.id]
    );
    if (!current?.length || current[0].status !== 'pending') {
      await connection.rollback();
      return false;
    }

    const dbTxStatus: 'failed' | 'cancelled' =
      reasonStatus === 'cancelled' ? 'cancelled' : 'failed';

    const historyNote: Record<OrderFailureReason, string> = {
      expired: 'Pesanan kedaluwarsa — tidak dibayar sebelum batas waktu',
      failed: 'Pembayaran gagal atau ditolak oleh gateway',
      cancelled: 'Pembayaran dibatalkan',
    };

    // Kembalikan stok produk
    const [items]: any = await connection.query(
      'SELECT product_id, quantity, variant FROM order_items WHERE order_id = ?',
      [trx.order_id]
    );
    for (const it of items) {
      await adjustProductStockAndVariant(
        connection,
        it.product_id,
        it.quantity,
        it.variant
      );
    }

    const storedRaw =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? { ...(raw as Record<string, unknown>), internal_reason: reasonStatus }
        : { raw: raw ?? null, internal_reason: reasonStatus };

    await connection.query(
      'UPDATE transactions SET status = ?, gateway_response = ? WHERE id = ?',
      [dbTxStatus, JSON.stringify(storedRaw), trx.id]
    );

    await connection.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [
      trx.order_id,
    ]);

    await connection.query(
      "INSERT INTO order_status_history (order_id, status, note) VALUES (?, 'cancelled', ?)",
      [trx.order_id, historyNote[reasonStatus]]
    );

    const nominal = Number(trx.total_amount || 0).toLocaleString('id-ID');
    const buyerTitle =
      reasonStatus === 'expired'
        ? 'Pesanan Kedaluwarsa'
        : reasonStatus === 'cancelled'
          ? 'Pembayaran Dibatalkan'
          : 'Pembayaran Gagal';

    await connection.query(
      `INSERT INTO notifications (user_id, title, message, type, reference_id)
       VALUES (?, ?, ?, 'order', ?)`,
      [
        trx.user_id,
        buyerTitle,
        `Pesanan #${trx.order_id} (Rp ${nominal}) dibatalkan otomatis. ${historyNote[reasonStatus]}. Silakan buat pesanan baru bila masih berminat.`,
        trx.order_id,
      ]
    );

    await connection.query(
      `INSERT INTO notifications (user_id, title, message, type, reference_id)
       VALUES (?, ?, ?, 'order', ?)`,
      [
        trx.mitra_user_id,
        'Pesanan Dibatalkan Otomatis',
        `Pesanan #${trx.order_id} dibatalkan otomatis (${reasonStatus === 'expired' ? 'kedaluwarsa' : historyNote[reasonStatus]}).`,
        trx.order_id,
      ]
    );

    await connection.commit();

    try {
      await pusher.trigger(`user-${trx.user_id}`, 'order-status-changed', {
        order_id: trx.order_id,
        status: 'cancelled',
        payment_status: reasonStatus,
      });
      await pusher.trigger(`user-${trx.mitra_user_id}`, 'order-status-changed', {
        order_id: trx.order_id,
        status: 'cancelled',
        payment_status: reasonStatus,
      });
    } catch {
      // Non-blocking
    }

    void sendPushNotificationToUser(
      trx.user_id,
      buyerTitle,
      `Pesanan #${trx.order_id} dibatalkan otomatis. Silakan buat pesanan baru bila masih berminat.`,
      { type: 'order', route: '/profile', order_id: String(trx.order_id), status: 'cancelled' }
    );

    return true;
  } catch (err) {
    await connection.rollback().catch(() => {});
    throw err;
  } finally {
    connection.release();
  }
}

/** Shortcut khusus untuk pesanan yang melewati batas waktu pembayaran. */
export async function expireOrder(
  trx: OrderFailureTarget,
  raw?: unknown
): Promise<boolean> {
  return cancelOrExpireOrderPayment(trx, 'expired', raw ?? { reason: 'expired' });
}

