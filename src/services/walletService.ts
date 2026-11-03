// ============================================================
//  src/services/walletService.ts
//  Saldo & Penarikan Dana Mitra (Wallet Ledger).
//  Saldo = total pesanan SELESAI − penarikan (pending + approved).
//  Penarikan diajukan mitra dan LANGSUNG DIPROSES (status 'approved')
//  tanpa perlu approval admin — cocok untuk demo tugas.
// ============================================================

import pool from '../config/database.js';

const COMPLETED_STATUSES = ['completed', 'delivered', 'selesai'];
const PENDING_EARN_STATUSES = ['paid', 'packed', 'shipped', 'processing'];
export const minWithdrawal = (): number =>
  Number(process.env['MIN_WITHDRAWAL'] || 50_000);

export const withdrawalFee = (): number =>
  Number(process.env['WITHDRAWAL_FEE'] || 0);

export interface WalletSummary {
  saldo_tersedia: number;
  pendapatan_tertunda: number;
  total_ditarik: number;
  min_withdrawal: number;
  withdrawal_fee: number;
}

async function getMitraProfile(userId: number): Promise<any | null> {
  const [rows]: any = await pool.query(
    'SELECT id, user_id, store_name FROM mitra_profiles WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

/** Ringkasan saldo mitra berdasarkan pesanan selesai & riwayat penarikan. */
export async function getWalletSummary(mitraId: number): Promise<WalletSummary> {
  const [earnRows]: any = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN LOWER(status) IN (${COMPLETED_STATUSES.map(() => '?').join(',')}) THEN total_amount ELSE 0 END), 0) AS completed_total,
       COALESCE(SUM(CASE WHEN LOWER(status) IN (${PENDING_EARN_STATUSES.map(() => '?').join(',')}) THEN total_amount ELSE 0 END), 0) AS pending_total
     FROM orders
     WHERE mitra_id = ? AND status != 'cancelled'`,
    [...COMPLETED_STATUSES, ...PENDING_EARN_STATUSES, mitraId]
  );

  const [withdrawRows]: any = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN status IN ('pending','approved') THEN amount ELSE 0 END), 0) AS locked_total,
       COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) AS withdrawn_total
     FROM withdrawal_requests
     WHERE mitra_id = ?`,
    [mitraId]
  );

  const completedTotal = Number(earnRows[0]?.completed_total || 0);
  const pendingTotal = Number(earnRows[0]?.pending_total || 0);
  const lockedTotal = Number(withdrawRows[0]?.locked_total || 0);
  const withdrawnTotal = Number(withdrawRows[0]?.withdrawn_total || 0);

  return {
    saldo_tersedia: Math.max(0, completedTotal - lockedTotal),
    pendapatan_tertunda: pendingTotal,
    total_ditarik: withdrawnTotal,
    min_withdrawal: minWithdrawal(),
    withdrawal_fee: withdrawalFee(),
  };
}

/** Riwayat pengajuan penarikan milik mitra. */
export async function listWithdrawals(mitraId: number, limit = 20) {
  const [rows]: any = await pool.query(
    `SELECT id, amount, fee, bank_name, account_number, account_name,
            status, admin_note, processed_at, created_at
     FROM withdrawal_requests
     WHERE mitra_id = ?
     ORDER BY id DESC
     LIMIT ?`,
    [mitraId, limit]
  );
  return rows;
}

/** Ajukan penarikan saldo. Melempar Error dengan pesan Indonesia bila tidak valid. */
export async function requestWithdrawal(
  userId: number,
  params: { amount: number; bank_name: string; account_number: string; account_name: string }
) {
  const mitra = await getMitraProfile(userId);
  if (!mitra) {
    throw Object.assign(new Error('Profil mitra tidak ditemukan.'), { status: 404 });
  }

  const amount = Math.round(Number(params.amount || 0));
  if (!amount || amount <= 0) {
    throw Object.assign(new Error('Nominal penarikan tidak valid.'), { status: 400 });
  }

  const min = minWithdrawal();
  if (amount < min) {
    throw Object.assign(
      new Error(`Minimal penarikan adalah Rp ${min.toLocaleString('id-ID')}.`),
      { status: 400 }
    );
  }

  const summary = await getWalletSummary(mitra.id);
  if (amount > summary.saldo_tersedia) {
    throw Object.assign(
      new Error(
        `Saldo tidak cukup. Saldo tersedia: Rp ${summary.saldo_tersedia.toLocaleString('id-ID')}.`
      ),
      { status: 400 }
    );
  }

  if (!params.bank_name?.trim() || !params.account_number?.trim() || !params.account_name?.trim()) {
    throw Object.assign(
      new Error('Nama bank, nomor rekening, dan nama pemilik rekening wajib diisi.'),
      { status: 400 }
    );
  }

  const fee = withdrawalFee();
  const connection = await pool.getConnection();
  let insertId: number;
  try {
    await connection.beginTransaction();

    const [result]: any = await connection.query(
      `INSERT INTO withdrawal_requests
         (user_id, mitra_id, amount, fee, bank_name, account_number, account_name, status, processed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', NOW())`,
      [
        userId,
        mitra.id,
        amount,
        fee,
        params.bank_name.trim(),
        params.account_number.trim(),
        params.account_name.trim(),
      ]
    );
    insertId = result.insertId;

    // Langsung disetujui (tanpa approval admin) — saldo otomatis terkunci
    // karena status 'approved' ikut dihitung sebagai dana keluar.
    await connection.query(
      `INSERT INTO notifications (user_id, title, message, type, reference_id)
       VALUES (?, ?, ?, 'withdrawal', ?)`,
      [
        userId,
        'Penarikan Berhasil Diproses',
        `Penarikan Rp ${amount.toLocaleString('id-ID')} ke ${params.bank_name.trim()} ${params.account_number.trim()} telah diproses. Dana akan masuk sesuai ketentuan bank (1-2 hari kerja).`,
        insertId,
      ]
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback().catch(() => {});
    throw err;
  } finally {
    connection.release();
  }

  return {
    id: insertId,
    amount,
    fee,
    status: 'approved',
    bank_name: params.bank_name.trim(),
    account_number: params.account_number.trim(),
    account_name: params.account_name.trim(),
  };
}

/** Admin: daftar semua pengajuan (opsional filter status). */
export async function adminListWithdrawals(status?: string, limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    const [rows]: any = await pool.query(
      `SELECT w.*, u.name AS mitra_name, m.store_name
       FROM withdrawal_requests w
       JOIN users u ON w.user_id = u.id
       JOIN mitra_profiles m ON w.mitra_id = m.id
       WHERE w.status = ?
       ORDER BY w.id DESC
       LIMIT ?`,
      [status, safeLimit]
    );
    return rows;
  }
  const [rows]: any = await pool.query(
    `SELECT w.*, u.name AS mitra_name, m.store_name
     FROM withdrawal_requests w
     JOIN users u ON w.user_id = u.id
     JOIN mitra_profiles m ON w.mitra_id = m.id
     ORDER BY w.id DESC
     LIMIT ?`,
    [safeLimit]
  );
  return rows;
}

/** Admin: setujui / tolak pengajuan. Idempoten — status lama tidak dioverride. */
export async function adminHandleWithdrawal(
  adminUserId: number,
  requestId: number,
  action: 'approve' | 'reject',
  adminNote?: string
) {
  const [rows]: any = await pool.query(
    'SELECT * FROM withdrawal_requests WHERE id = ? LIMIT 1',
    [requestId]
  );
  if (!rows || rows.length === 0) {
    throw Object.assign(new Error('Pengajuan penarikan tidak ditemukan.'), { status: 404 });
  }
  const wr = rows[0];
  if (wr.status !== 'pending') {
    throw Object.assign(
      new Error(`Pengajuan ini sudah diproses (status: ${wr.status}).`),
      { status: 400 }
    );
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  await pool.query(
    `UPDATE withdrawal_requests
     SET status = ?, admin_note = ?, processed_by = ?, processed_at = NOW()
     WHERE id = ?`,
    [newStatus, adminNote?.trim() || null, adminUserId, requestId]
  );

  const nominal = Number(wr.amount).toLocaleString('id-ID');
  const title = newStatus === 'approved' ? 'Penarikan Disetujui' : 'Penarikan Ditolak';
  const message =
    newStatus === 'approved'
      ? `Penarikan Rp ${nominal} telah disetujui dan akan ditransfer ke ${wr.bank_name} ${wr.account_number}.`
      : `Penarikan Rp ${nominal} ditolak.${adminNote ? ` Alasan: ${adminNote.trim()}` : ''} Saldo kembali tersedia.`;

  await pool.query(
    `INSERT INTO notifications (user_id, title, message, type, reference_id)
     VALUES (?, ?, ?, 'withdrawal', ?)`,
    [wr.user_id, title, message, wr.id]
  );

  return { id: wr.id, status: newStatus, amount: Number(wr.amount) };
}
