// ============================================================
//  src/services/orderSettlement.ts
//  Penyelesaian pesanan: menandai pesanan LUNAS secara idempoten.
//  Dipakai bersama oleh: webhook Midtrans, polling mobile, dan background poller.
// ============================================================

import pool from '../config/database.js';
import { sendPushNotificationToUser } from './notificationService.js';
import pusher from '../utils/pusher.js';

export interface PendingTransactionRow {
  id: number;
  order_id: number;
  user_id: number;
  mitra_user_id: number;
  total_amount: number;
  amount?: number;
  gateway_fee?: number;
  status: string;
}

/**
 * Tandai transaksi + pesanan sebagai 'paid'/'success', kirim notifikasi ke
 * mitra & pembeli, dan trigger Pusher. Idempoten: jika transaksi sudah
 * 'success', tidak melakukan apa-apa dan mengembalikan false.
 */
export async function settleOrderPaid(trx: {
  id: number;
  order_id: number;
  user_id: number;
  mitra_user_id: number;
  total_amount: number;
  status?: string;
}): Promise<boolean> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Idempotency guard — cek ulang di dalam lock transaksi.
    const [current]: any = await connection.query(
      'SELECT status FROM transactions WHERE id = ? FOR UPDATE',
      [trx.id]
    );
    if (!current || current.length === 0 || current[0].status === 'success') {
      await connection.rollback();
      return false;
    }

    await connection.query(
      "UPDATE transactions SET status = 'success', paid_at = COALESCE(paid_at, NOW()) WHERE id = ?",
      [trx.id]
    );

    await connection.query("UPDATE orders SET status = 'paid' WHERE id = ?", [
      trx.order_id,
    ]);

    // Timeline tracking: pembayaran terverifikasi
    await connection.query(
      'INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)',
      [trx.order_id, 'paid', 'Pembayaran terverifikasi']
    );

    const nominal = Number(trx.total_amount || 0).toLocaleString('id-ID');

    await connection.query(
      `INSERT INTO notifications (user_id, title, message, type, reference_id)
       VALUES (?, ?, ?, 'order', ?)`,
      [
        trx.mitra_user_id,
        'Pembayaran Diterima!',
        `Pesanan #${trx.order_id} telah dibayar lunas sebesar Rp ${nominal}. Segera proses pesanan ini.`,
        trx.order_id,
      ]
    );

    await connection.query(
      `INSERT INTO notifications (user_id, title, message, type, reference_id)
       VALUES (?, ?, ?, 'order', ?)`,
      [
        trx.user_id,
        'Pembayaran Berhasil',
        `Pembayaran pesanan #${trx.order_id} telah berhasil dikonfirmasi. Penjual akan segera memproses barang Anda.`,
        trx.order_id,
      ]
    );

    await connection.commit();

    try {
      await pusher.trigger(`user-${trx.user_id}`, 'order-paid', {
        order_id: trx.order_id,
        status: 'paid',
        title: 'Pembayaran Berhasil',
        message: `Pembayaran pesanan #${trx.order_id} telah berhasil dikonfirmasi. Penjual akan segera memproses barang Anda.`,
      });
      await pusher.trigger(`user-${trx.mitra_user_id}`, 'new-paid-order', {
        order_id: trx.order_id,
        status: 'paid',
      });
    } catch {
      // Pusher gagal — non-blocking.
    }

    // Push FCM ke perangkat mitra & pembeli (non-blocking).
    void sendPushNotificationToUser(
      trx.mitra_user_id,
      'Pembayaran Diterima!',
      `Pesanan #${trx.order_id} telah dibayar lunas sebesar Rp ${Number(trx.total_amount || 0).toLocaleString('id-ID')}. Segera proses pesanan ini.`,
      { type: 'order', route: '/profile', order_id: String(trx.order_id), status: 'paid' }
    );
    void sendPushNotificationToUser(
      trx.user_id,
      'Pembayaran Berhasil',
      `Pembayaran pesanan #${trx.order_id} telah berhasil dikonfirmasi. Penjual akan segera memproses barang Anda.`,
      { type: 'order', route: '/profile', order_id: String(trx.order_id), status: 'paid' }
    );

    console.log(`✅ [settleOrderPaid] Pesanan #${trx.order_id} ditandai LUNAS.`);
    return true;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Cari transaksi berdasarkan gateway_order_id (utama) atau payment_token.
 * Dipakai webhook Midtrans: order_id notifikasi = gateway_order_id kita.
 */
export async function findTransactionByRef(
  gatewayOrderId?: string,
  token?: string
): Promise<PendingTransactionRow | null> {
  const [rows]: any = await pool.query(
    `SELECT t.id, o.id AS order_id, o.user_id, o.mitra_id, o.total_amount,
            t.amount, t.gateway_fee, t.status, m.user_id AS mitra_user_id
     FROM transactions t
     JOIN orders o ON o.transaction_id = t.id
     JOIN mitra_profiles m ON o.mitra_id = m.id
     WHERE t.gateway_order_id = ? OR t.payment_token = ?
     LIMIT 1`,
    [gatewayOrderId || '', token || '']
  );
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    order_id: r.order_id,
    user_id: r.user_id,
    mitra_user_id: r.mitra_user_id,
    total_amount: Number(r.total_amount || 0),
    amount: Number(r.amount || 0),
    gateway_fee: Number(r.gateway_fee || 0),
    status: r.status,
  };
}
