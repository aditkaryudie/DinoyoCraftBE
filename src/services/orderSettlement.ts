// ============================================================
//  src/services/orderSettlement.ts
//  Penyelesaian pesanan: menandai pesanan LUNAS secara idempoten.
//  Dipakai bersama oleh: webhook scbz, polling mobile, dan background poller
//  (pengganti webhook dispatcher Go pada sidecar lama).
// ============================================================

import pool from '../config/database.js';
import pusher from '../utils/pusher.js';

export interface PendingTransactionRow {
  id: number;
  order_id: number;
  user_id: number;
  mitra_user_id: number;
  total_amount: number;
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
    // Idempotency guard — cek ulang di dalam lock transaksi.
    const [current]: any = await connection.query(
      'SELECT status FROM transactions WHERE id = ? FOR UPDATE',
      [trx.id]
    );
    if (!current || current.length === 0 || current[0].status === 'success') {
      return false;
    }

    await connection.beginTransaction();

    await connection.query("UPDATE transactions SET status = 'success' WHERE id = ?", [
      trx.id,
    ]);

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
      });
      await pusher.trigger(`user-${trx.mitra_user_id}`, 'new-paid-order', {
        order_id: trx.order_id,
        status: 'paid',
      });
    } catch {
      // Pusher gagal — non-blocking.
    }

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
 * Cari transaksi berdasarkan inv_id atau payment_token (dipakai webhook).
 */
export async function findTransactionByRef(
  invId?: string,
  token?: string
): Promise<PendingTransactionRow | null> {
  const [rows]: any = await pool.query(
    `SELECT t.id, o.id AS order_id, o.user_id, o.mitra_id, o.total_amount,
            t.status, m.user_id AS mitra_user_id
     FROM transactions t
     JOIN orders o ON o.transaction_id = t.id
     JOIN mitra_profiles m ON o.mitra_id = m.id
     WHERE t.inv_id = ? OR t.payment_token = ?
     LIMIT 1`,
    [invId || '', token || '']
  );
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    order_id: r.order_id,
    user_id: r.user_id,
    mitra_user_id: r.mitra_user_id,
    total_amount: r.total_amount,
    status: r.status,
  };
}
