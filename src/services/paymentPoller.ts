// ============================================================
//  src/services/paymentPoller.ts
//  Background Poller Pembayaran — pengganti WebhookDispatcher Go (scbz).
//  Scan transaksi pending setiap POLL_INTERVAL detik, cek status ke
//  SociaBuzz, dan otomatis menandai pesanan lunas bila terbayar.
// ============================================================

import pool from '../config/database.js';
import * as paymentService from './paymentService.js';
import { settleOrderPaid } from './orderSettlement.js';

const POLL_INTERVAL_MS = Number(process.env['PAYMENT_POLL_INTERVAL_MS'] || 30_000);
const MAX_AGE_HOURS = Number(process.env['PAYMENT_POLL_MAX_AGE_HOURS'] || 24);

const inFlight = new Set<number>();
let timer: ReturnType<typeof setInterval> | null = null;

async function pollOnce(): Promise<void> {
  try {
    // Ambil transaksi pending yang sudah punya token pembayaran.
    const [rows]: any = await pool.query(
      `SELECT t.id, o.id AS order_id, o.user_id, o.total_amount,
              t.payment_token, t.inv_id, t.transaction_type,
              m.user_id AS mitra_user_id
       FROM transactions t
       JOIN orders o ON o.transaction_id = t.id
       JOIN mitra_profiles m ON o.mitra_id = m.id
       WHERE t.status = 'pending'
         AND t.payment_token IS NOT NULL
         AND t.created_at > NOW() - INTERVAL ? HOUR
       ORDER BY t.id ASC
       LIMIT 25`,
      [MAX_AGE_HOURS]
    );

    for (const row of rows) {
      if (inFlight.has(row.id)) continue;
      inFlight.add(row.id);

      // Fire-and-forget per transaksi agar satu cek lambat tidak menahan lainnya.
      void (async () => {
        try {
          const result: any = await paymentService.verifyPaymentStatus(
            row.payment_token,
            row.transaction_type || 'qris',
            row.inv_id || row.payment_token
          );
          if (result.status === 'paid') {
            await settleOrderPaid({
              id: row.id,
              order_id: row.order_id,
              user_id: row.user_id,
              mitra_user_id: row.mitra_user_id,
              total_amount: row.total_amount,
            });
          }
        } catch (err: any) {
          console.warn('⚠️ [paymentPoller] Gagal cek transaksi #' + row.id + ':', err.message);
        } finally {
          inFlight.delete(row.id);
        }
      })();
    }
  } catch (err: any) {
    console.warn('⚠️ [paymentPoller] Gagal scan transaksi pending:', err.message);
  }
}

/** Jalankan poller di background (sekali saja per proses). */
export function startPaymentPoller(): void {
  if (timer) return;
  if (process.env['PAYMENT_POLLER_ENABLED'] === 'false') {
    console.log('⏸️ [paymentPoller] Dimatikan via PAYMENT_POLLER_ENABLED=false');
    return;
  }

  // Cek pertama setelah 10 detik server siap, lalu berkala.
  setTimeout(() => void pollOnce(), 10_000).unref?.();
  timer = setInterval(() => void pollOnce(), POLL_INTERVAL_MS);
  timer.unref?.();
  console.log(`🔄 [paymentPoller] Aktif — memeriksa pembayaran pending tiap ${POLL_INTERVAL_MS / 1000}s`);
}
