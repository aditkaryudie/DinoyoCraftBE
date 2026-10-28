// ============================================================
//  src/controllers/adminController.ts
//  Controller Admin — manajemen user dan master data
// ============================================================

import { Request, Response } from 'express';
import pool from '../config/database.js';
import { pusher } from '../utils/pusher.js';
import {
  sendSuccess,
  sendError,
  sendNotFound,
  sendBadRequest,
} from '../utils/response.js';
import {
  UserEntity,
  SafeUser,
  CreateMasterDataDto,
  CountResult,
} from '../types/index.js';
import { getAuthLocals } from '../middlewares/authMiddleware.js';

const sanitizeUser = (user: UserEntity): SafeUser => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, token_version, ...safe } = user;
  return safe as SafeUser;
};

/**
 * GET /api/admin/dashboard-stats
 * Ringkasan statistik dan aktivitas dashboard admin
 */
export const getDashboardStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    // 1. Toko Pengrajin Aktif (Terverifikasi & Aktif)
    const [tokoAktifRows] = await pool.execute<any[]>(
      'SELECT COUNT(*) AS total FROM mitra_profiles WHERE is_verified = 1 AND is_active = 1'
    );
    const tokoPengrajinAktif = Number(tokoAktifRows[0]?.total ?? 0);

    // 2. Pengajuan Toko Baru (Menunggu Verifikasi)
    const [tokoPendingRows] = await pool.execute<any[]>(
      'SELECT COUNT(*) AS total FROM mitra_profiles WHERE is_verified = 0'
    );
    const pengajuanTokoBaru = Number(tokoPendingRows[0]?.total ?? 0);

    // 3. Total Transaksi & Omzet dari tabel orders (dan fallback transactions jika ada)
    const [orderStatsRows] = await pool.execute<any[]>(
      `SELECT 
        COUNT(*) AS totalTransaksi,
        COALESCE(SUM(total_amount), 0) AS totalOmzet
       FROM orders
       WHERE status != 'cancelled'`
    );
    let totalTransaksi = Number(orderStatsRows[0]?.totalTransaksi ?? 0);
    let totalOmzet = Number(orderStatsRows[0]?.totalOmzet ?? 0);

    // Jika orders kosong, periksa tabel transactions
    if (totalTransaksi === 0) {
      const [trxStatsRows] = await pool.execute<any[]>(
        `SELECT 
          COUNT(*) AS totalTransaksi,
          COALESCE(SUM(amount), 0) AS totalOmzet
         FROM transactions
         WHERE status = 'success'`
      );
      totalTransaksi = Number(trxStatsRows[0]?.totalTransaksi ?? 0);
      totalOmzet = Number(trxStatsRows[0]?.totalOmzet ?? 0);
    }

    // 4. Kunjungan Wisatawan (Total pengunjung unik dari log / pembeli)
    const [visitorRows] = await pool.execute<any[]>(
      `SELECT COUNT(DISTINCT ip_address) AS total FROM audit_logs WHERE ip_address IS NOT NULL`
    );
    let kunjunganWisatawan = Number(visitorRows[0]?.total ?? 0);
    if (kunjunganWisatawan === 0) {
      const [userCountRows] = await pool.execute<any[]>(
        `SELECT COUNT(*) AS total FROM users WHERE role = 'buyer'`
      );
      kunjunganWisatawan = Number(userCountRows[0]?.total ?? 0);
    }

    // 5. Transaksi Terbaru
    const [latestOrders] = await pool.execute<any[]>(
      `SELECT 
        COALESCE(o.tracking_number, CONCAT('INV/', DATE_FORMAT(o.created_at, '%Y/%m/'), LPAD(o.id, 4, '0'))) AS id,
        COALESCE(m.store_name, 'Toko Mitra') AS toko,
        CAST(o.total_amount AS UNSIGNED) AS nominal
       FROM orders o
       LEFT JOIN mitra_profiles m ON o.mitra_id = m.id
       ORDER BY o.created_at DESC
       LIMIT 5`
    );

    let transaksiTerbaru = (latestOrders || []).map((row: any) => ({
      id: String(row.id),
      toko: String(row.toko),
      nominal: Number(row.nominal || 0)
    }));

    if (transaksiTerbaru.length === 0) {
      const [latestTransactions] = await pool.execute<any[]>(
        `SELECT 
          COALESCE(t.reference_code, CONCAT('TRX/', DATE_FORMAT(t.created_at, '%Y/%m/'), LPAD(t.id, 4, '0'))) AS id,
          'Transaksi Platform' AS toko,
          CAST(t.amount AS UNSIGNED) AS nominal
         FROM transactions t
         ORDER BY t.created_at DESC
         LIMIT 5`
      );
      transaksiTerbaru = (latestTransactions || []).map((row: any) => ({
        id: String(row.id),
        toko: String(row.toko),
        nominal: Number(row.nominal || 0)
      }));
    }

    const dashboardData = {
      totalTransaksi,
      totalOmzet,
      kunjunganWisatawan,
      tokoPengrajinAktif,
      pengajuanTokoBaru,
      transaksiTerbaru
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ success: false, message: "Terjadi kesalahan pada server" });
  }
};

/**
 * GET /api/admin/users
 */
export const getAllUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(_req.query['page'] as string) || 1);
    const limit = Math.min(100, parseInt(_req.query['limit'] as string) || 20);
    const offset = (page - 1) * limit;

    const [rows] = await pool.execute<UserEntity[]>(
      `SELECT id, name, email, role, is_active, created_at, updated_at
       FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [countRows] = await pool.execute<CountResult[]>(
      'SELECT COUNT(*) as total FROM users'
    );

    const total = countRows[0]?.total ?? 0;

    sendSuccess(res, rows.map(sanitizeUser), 'Daftar pengguna berhasil diambil.', 200, {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    sendError(res, 'Gagal mengambil data pengguna.', 500, String(err));
  }
};

/**
 * PATCH /api/admin/users/:id/status
 */
export const updateUserStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt((req.params as { id: string }).id ?? '0');
    const { is_active } = req.body as { is_active: boolean };

    if (typeof is_active !== 'boolean') {
      sendBadRequest(res, 'Field is_active harus berupa boolean.');
      return;
    }

    const [result] = await pool.execute(
      'UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?',
      [is_active, userId]
    );

    if ((result as { affectedRows: number }).affectedRows === 0) {
      sendNotFound(res, 'Pengguna tidak ditemukan.');
      return;
    }

    sendSuccess(res, { userId, is_active }, 'Status pengguna berhasil diperbarui.');
  } catch (err) {
    sendError(res, 'Gagal memperbarui status pengguna.', 500, String(err));
  }
};

/**
 * GET /api/admin/master-data
 */
export const getMasterData = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = req.query['category'] as string | undefined;
    const query = category
      ? 'SELECT * FROM master_data WHERE category = ? ORDER BY `key` ASC'
      : 'SELECT * FROM master_data ORDER BY category ASC, `key` ASC';
    const params = category ? [category] : [];

    const [rows] = await pool.execute(query, params);
    sendSuccess(res, rows, 'Data master berhasil diambil.');
  } catch (err) {
    sendError(res, 'Gagal mengambil data master.', 500, String(err));
  }
};

/**
 * POST /api/admin/master-data
 */
export const createMasterData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = getAuthLocals(res);
    const { category, key, value, description } = req.body as CreateMasterDataDto;

    const [result] = await pool.execute(
      `INSERT INTO master_data (category, \`key\`, value, description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [category, key, value, description ?? null, userId]
    );

    sendSuccess(
      res,
      { id: (result as { insertId: number }).insertId, category, key, value },
      'Data master berhasil dibuat.',
      201
    );
  } catch (err) {
    sendError(res, 'Gagal membuat data master.', 500, String(err));
  }
};

/**
 * GET /api/admin/verifikasi
 * Mendapatkan daftar semua pengajuan verifikasi toko mitra
 */
export const getVerifikasiList = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.execute(
      `SELECT 
        m.id, 
        m.user_id, 
        m.store_name, 
        m.workshop_address, 
        m.started_year, 
        m.whatsapp_number, 
        m.description,
        m.website,
        m.instagram,
        m.ktp_file_url, 
        m.nib_file_url, 
        m.is_verified,
        m.rejection_reason,
        m.is_active, 
        m.created_at, 
        u.name AS owner_name, 
        u.email
       FROM mitra_profiles m
       JOIN users u ON m.user_id = u.id
       ORDER BY m.created_at DESC`
    );

    sendSuccess(res, rows, 'Daftar pengajuan verifikasi toko berhasil diambil.');
  } catch (err) {
    sendError(res, 'Gagal mengambil data verifikasi toko.', 500, String(err));
  }
};

/**
 * PATCH /api/admin/verifikasi/:id
 * Setujui ('approved') atau tolak ('rejected') verifikasi toko mitra
 */
export const verifyMitraStore = async (req: Request, res: Response): Promise<void> => {
  try {
    const mitraId = parseInt((req.params as { id: string }).id ?? '0');
    const { status, reason } = req.body as { status: 'approved' | 'rejected'; reason?: string };

    if (!['approved', 'rejected'].includes(status)) {
      sendBadRequest(res, "Status verifikasi harus 'approved' atau 'rejected'.");
      return;
    }

    // Cek keberadaan profil mitra
    const [rows] = await pool.execute<any[]>(
      'SELECT user_id FROM mitra_profiles WHERE id = ?',
      [mitraId]
    );

    if (!rows.length) {
      sendNotFound(res, 'Data pengajuan toko mitra tidak ditemukan.');
      return;
    }

    const userId = rows[0].user_id;
    const isApproved = status === 'approved';
    const isVerifiedVal = isApproved ? 1 : 2;
    const rejectionReason = isApproved ? null : (reason?.trim() || 'Dokumen belum lengkap atau tidak sesuai ketentuan.');

    // Update status di tabel mitra_profiles
    await pool.execute(
      'UPDATE mitra_profiles SET is_verified = ?, is_active = 1, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
      [isVerifiedVal, rejectionReason, mitraId]
    );

    // Update status akun user di tabel users (tetap aktif agar bisa login & melengkapi dokumen)
    await pool.execute(
      'UPDATE users SET is_active = 1, updated_at = NOW() WHERE id = ?',
      [userId]
    );

    // Kirim notifikasi realtime via Pusher Channels ke mitra terkait
    try {
      await pusher.trigger(
        [`user-${userId}`, `mitra-${mitraId}`, 'mitra-verification'],
        'verification-status-updated',
        {
          mitraId,
          userId,
          status,
          is_verified: isVerifiedVal,
          rejection_reason: rejectionReason,
          timestamp: new Date().toISOString(),
        }
      );
      console.log(`[Pusher Backend] Event 'verification-status-updated' berhasil dikirim ke user-${userId}`);
    } catch (pusherErr) {
      console.warn('⚠️ Pusher trigger error pada verifikasi mitra:', pusherErr);
    }

    const message = isApproved
      ? 'Toko mitra berhasil disetujui.'
      : 'Pengajuan toko mitra telah ditolak.';

    sendSuccess(res, { mitraId, status, rejectionReason }, message);
  } catch (err) {
    sendError(res, 'Gagal memproses verifikasi toko mitra.', 500, String(err));
  }
};
