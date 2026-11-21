// ============================================================
//  src/controllers/moderationController.ts
//  Controller Moderasi & Keamanan (Admin Only)
// ============================================================

import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/database.js';

let tablesInitialized = false;
let initTablesPromise: Promise<void> | null = null;

/**
 * Memastikan tabel reports dan account_deletions tersedia di database (tanpa mock data)
 */
const ensureModerationTables = async (): Promise<void> => {
  if (tablesInitialized) return;
  if (initTablesPromise) return initTablesPromise;

  initTablesPromise = (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`reports\` (
          \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
          \`reporter_id\` int UNSIGNED DEFAULT NULL,
          \`reporter_name\` varchar(150) NOT NULL,
          \`type\` varchar(50) NOT NULL,
          \`target_id\` int UNSIGNED DEFAULT NULL,
          \`target_name\` varchar(255) NOT NULL,
          \`reason\` text NOT NULL,
          \`status\` varchar(50) NOT NULL DEFAULT 'pending',
          \`resolved_at\` datetime DEFAULT NULL,
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS \`account_deletions\` (
          \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
          \`user_id\` int UNSIGNED DEFAULT NULL,
          \`name\` varchar(100) NOT NULL,
          \`email\` varchar(255) NOT NULL,
          \`reason\` text NOT NULL,
          \`status\` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
          \`resolved_at\` datetime DEFAULT NULL,
          \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      tablesInitialized = true;
    } catch (err) {
      console.warn('⚠️ [ensureModerationTables] Inisialisasi tabel:', err);
    } finally {
      initTablesPromise = null;
    }
  })();

  return initTablesPromise;
};

/**
 * Format tanggal ke format lokal yang ramah dibaca (contoh: 24 Okt 2023)
 */
const formatDate = (date: any): string => {
  if (!date) return '-';
  try {
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return String(date);
  }
};

/**
 * [GET] /api/admin/moderation/reports
 * Mengambil daftar laporan pelanggaran dengan filter Tipe, Status, dan Pencarian
 */
export const getReports = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureModerationTables();

    const { search, type, status, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Number(limit) || 10);
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: any[] = [];

    // Filter Status (Pending, Selesai / Resolved)
    if (status && status !== 'Semua Status' && status !== 'semua') {
      const statusStr = String(status).toLowerCase();
      if (statusStr === 'pending') {
        conditions.push("(LOWER(status) = 'pending')");
      } else if (statusStr === 'selesai' || statusStr === 'resolved') {
        conditions.push("(LOWER(status) = 'resolved' OR LOWER(status) = 'selesai')");
      } else {
        conditions.push('LOWER(status) = ?');
        params.push(statusStr);
      }
    }

    // Filter Tipe (Toko, Ulasan, Produk)
    if (type && type !== 'Semua Tipe' && type !== 'semua') {
      conditions.push('LOWER(type) = ?');
      params.push(String(type).toLowerCase());
    }

    // Pencarian berdasarkan nama pelapor, target, atau alasan
    if (search && String(search).trim()) {
      const keyword = `%${String(search).trim()}%`;
      conditions.push('(reporter_name LIKE ? OR target_name LIKE ? OR reason LIKE ?)');
      params.push(keyword, keyword, keyword);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Hitung total data
    const [countRows]: any = await pool.query(
      `SELECT COUNT(*) as total FROM reports ${whereClause}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    // Ambil data laporan terpaginasi
    const [reports]: any = await pool.query(
      `SELECT id, reporter_id, reporter_name, type, target_id, target_name, reason, status, resolved_at, created_at, updated_at
       FROM reports
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    // Format agar cocok dengan antarmuka Next.js dan Flutter
    const formattedReports = reports.map((r: any) => ({
      id: String(r.id),
      type: (r.type || 'toko').toLowerCase(),
      target: r.target_name,
      target_id: r.target_id,
      reporter: r.reporter_name,
      reporter_name: r.reporter_name,
      reason: r.reason,
      status: (r.status === 'Selesai' || r.status === 'resolved') ? 'resolved' : 'pending',
      date: formatDate(r.created_at),
      created_at: r.created_at,
      resolved_at: r.resolved_at
    }));

    res.status(200).json({
      success: true,
      data: formattedReports,
      total,
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1
    });
  } catch (error: any) {
    console.error('❌ Error getReports:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data laporan', error: error.message });
  }
};

/**
 * [PUT] /api/admin/moderation/reports/:id/action
 * Mengeksekusi tindakan moderasi terhadap laporan (suspend toko/produk, hapus ulasan, atau abaikan)
 */
export const handleReportAction = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureModerationTables();

    const { id } = req.params;
    const { action, targetId, type } = req.body; // action: 'abaikan' | 'suspend' | 'hapus' | 'delete' | 'ignore'

    const [rows]: any = await pool.query('SELECT * FROM reports WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      res.status(404).json({ success: false, message: 'Laporan tidak ditemukan' });
      return;
    }

    const report = rows[0];
    const targetEntityId = targetId || report.target_id;
    const reportType = (type || report.type || '').toLowerCase();
    const actionType = (action || '').toLowerCase();

    // Eksekusi tindakan berdasarkan tombol yang ditekan admin
    if (actionType === 'suspend' && (reportType === 'toko' || reportType === 'store')) {
      if (targetEntityId) {
        await pool.query(
          'UPDATE mitra_profiles SET is_active = 0 WHERE id = ?',
          [targetEntityId]
        );
      }
    } else if ((actionType === 'hapus' || actionType === 'delete') && (reportType === 'ulasan' || reportType === 'review')) {
      if (targetEntityId) {
        try {
          const [revRows]: any = await pool.query(
            'SELECT r.product_id, p.mitra_id FROM reviews r LEFT JOIN products p ON r.product_id = p.id WHERE r.id = ? LIMIT 1',
            [targetEntityId]
          );
          const reviewedProductId = revRows?.[0]?.product_id;
          const reviewedMitraId = revRows?.[0]?.mitra_id;
          await pool.query('DELETE FROM reviews WHERE id = ?', [targetEntityId]);
          if (reviewedProductId) {
            const [prodStats]: any = await pool.query(
              'SELECT COUNT(*) AS total, COALESCE(AVG(rating), 0) AS avg_rating FROM reviews WHERE product_id = ?',
              [reviewedProductId]
            );
            await pool.query(
              'UPDATE products SET rating = ?, total_reviews = ? WHERE id = ?',
              [
                Number(prodStats?.[0]?.total || 0) > 0 ? Number(prodStats[0].avg_rating).toFixed(2) : 0,
                Number(prodStats?.[0]?.total || 0),
                reviewedProductId,
              ]
            );
          }
          if (reviewedMitraId) {
            const [mitraStats]: any = await pool.query(
              `SELECT COUNT(r.id) AS total, COALESCE(AVG(r.rating), 0) AS avg_rating
               FROM reviews r
               JOIN products p ON r.product_id = p.id
               WHERE p.mitra_id = ?`,
              [reviewedMitraId]
            );
            await pool.query(
              'UPDATE mitra_profiles SET rating = ?, total_reviews = ? WHERE id = ?',
              [
                Number(mitraStats?.[0]?.total || 0) > 0 ? Number(mitraStats[0].avg_rating).toFixed(2) : 0,
                Number(mitraStats?.[0]?.total || 0),
                reviewedMitraId,
              ]
            );
          }
        } catch {
          // Abaikan jika tabel reviews belum terpasang
        }
      }
    } else if (
      ['suspend', 'hapus', 'delete', 'takedown'].includes(actionType) &&
      (reportType === 'produk' || reportType === 'product')
    ) {
      if (targetEntityId) {
        await pool.query(
          'UPDATE products SET is_deleted = 1 WHERE id = ?',
          [targetEntityId]
        );
      }
    }
    // Jika 'abaikan' / 'ignore', tidak ada entitas yang diubah, hanya status laporan yang diperbarui

    // Ubah status laporan menjadi selesai / resolved
    await pool.query(
      "UPDATE reports SET status = 'resolved', resolved_at = NOW() WHERE id = ?",
      [id]
    );

    res.status(200).json({
      success: true,
      message: `Tindakan ${action} berhasil diterapkan.`
    });
  } catch (error: any) {
    console.error('❌ Error handleReportAction:', error);
    res.status(500).json({ success: false, message: 'Gagal memproses tindakan', error: error.message });
  }
};

/**
 * [GET] /api/admin/moderation/account-deletions
 * Mengambil daftar pengajuan penghapusan akun customer
 */
export const getDeletionRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureModerationTables();

    const { search, status, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Number(limit) || 10);
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: any[] = [];

    // Filter Status (pending, approved, rejected)
    if (status && status !== 'Semua Status' && status !== 'semua') {
      conditions.push('LOWER(status) = ?');
      params.push(String(status).toLowerCase());
    }

    // Pencarian berdasarkan nama, email, atau alasan
    if (search && String(search).trim()) {
      const keyword = `%${String(search).trim()}%`;
      conditions.push('(name LIKE ? OR email LIKE ? OR reason LIKE ?)');
      params.push(keyword, keyword, keyword);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Hitung total data
    const [countRows]: any = await pool.query(
      `SELECT COUNT(*) as total FROM account_deletions ${whereClause}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    // Ambil data pengajuan terpaginasi
    const [deletions]: any = await pool.query(
      `SELECT id, user_id, name, email, reason, status, resolved_at, created_at
       FROM account_deletions
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const formattedDeletions = deletions.map((d: any) => ({
      id: String(d.id),
      user_id: d.user_id,
      name: d.name,
      email: d.email,
      reason: d.reason,
      status: d.status,
      date: formatDate(d.created_at),
      created_at: d.created_at,
      resolved_at: d.resolved_at
    }));

    res.status(200).json({
      success: true,
      data: formattedDeletions,
      total,
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1
    });
  } catch (error: any) {
    console.error('❌ Error getDeletionRequests:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data pengajuan hapus akun', error: error.message });
  }
};

/**
 * [PUT] /api/admin/moderation/account-deletions/:id/action
 * Setujui atau tolak pengajuan penghapusan akun
 */
export const handleDeletionAction = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureModerationTables();

    const { id } = req.params;
    const { action } = req.body; // 'approved' | 'rejected'

    if (!action || !['approved', 'rejected'].includes(action)) {
      res.status(400).json({ success: false, message: "Action harus berupa 'approved' atau 'rejected'" });
      return;
    }

    const [rows]: any = await pool.query('SELECT * FROM account_deletions WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      res.status(404).json({ success: false, message: 'Pengajuan hapus akun tidak ditemukan' });
      return;
    }

    const delReq = rows[0];

    // Jika disetujui, nonaktifkan akun pengguna & cabut seluruh sesi token aktif
    if (action === 'approved') {
      if (delReq.user_id) {
        await pool.query(
          'UPDATE users SET is_active = 0, token_version = token_version + 1 WHERE id = ?',
          [delReq.user_id]
        );
      } else if (delReq.email) {
        await pool.query(
          'UPDATE users SET is_active = 0, token_version = token_version + 1 WHERE email = ?',
          [delReq.email]
        );
      }
    }

    // Update status pengajuan
    await pool.query(
      'UPDATE account_deletions SET status = ?, resolved_at = NOW() WHERE id = ?',
      [action, id]
    );

    res.status(200).json({
      success: true,
      message: action === 'approved'
        ? 'Pengajuan penghapusan akun disetujui. Akun telah dinonaktifkan.'
        : 'Pengajuan penghapusan akun ditolak.'
    });
  } catch (error: any) {
    console.error('❌ Error handleDeletionAction:', error);
    res.status(500).json({ success: false, message: 'Gagal memproses pengajuan hapus akun', error: error.message });
  }
};

export const submitReport = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureModerationTables();
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    const { type, target_id, target_name, reason } = req.body;

    if (!type || !reason) {
      res.status(400).json({ success: false, message: 'Tipe dan alasan laporan wajib diisi' });
      return;
    }

    let reporterName = 'Pengguna';
    if (userId) {
      const [uRows]: any = await pool.query('SELECT name FROM users WHERE id = ?', [userId]);
      if (uRows && uRows.length > 0) reporterName = uRows[0].name;
    }

    const numericTargetId =
      target_id !== undefined && target_id !== null && !isNaN(Number(target_id)) && Number(target_id) > 0
        ? Number(target_id)
        : null;

    const [result]: any = await pool.query(
      `INSERT INTO reports (reporter_id, reporter_name, type, target_id, target_name, reason, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [userId || null, reporterName, type, numericTargetId, target_name || '-', reason]
    );

    res.status(201).json({
      success: true,
      message: 'Laporan Anda telah diterima dan akan ditinjau oleh tim kami.',
      reportId: result.insertId
    });
  } catch (error: any) {
    console.error('Error submitReport:', error);
    res.status(500).json({ success: false, message: 'Gagal mengirim laporan', error: error.message });
  }
};

export const getMyAccountDeletionStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureModerationTables();
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const [uRows]: any = await pool.query(
      'SELECT id, name, email, password_hash, google_id FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (!uRows || uRows.length === 0) {
      res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
      return;
    }
    const user = uRows[0];

    const [activeOrders]: any = await pool.query(
      "SELECT COUNT(*) AS cnt FROM orders WHERE user_id = ? AND status IN ('pending', 'paid', 'packed', 'shipped')",
      [userId]
    );

    const [delRows]: any = await pool.query(
      'SELECT id, reason, status, created_at, resolved_at FROM account_deletions WHERE user_id = ? OR email = ? ORDER BY id DESC LIMIT 5',
      [userId, user.email]
    );

    const pendingRequest = (delRows || []).find((r: any) => r.status === 'pending') || null;
    const latestRequest = (delRows || [])[0] || null;

    res.status(200).json({
      success: true,
      data: {
        email: user.email,
        has_password: Boolean(user.password_hash),
        has_active_orders: Number(activeOrders?.[0]?.cnt ?? 0) > 0,
        active_orders_count: Number(activeOrders?.[0]?.cnt ?? 0),
        pending_request: pendingRequest,
        latest_request: latestRequest,
      },
    });
  } catch (error: any) {
    console.error('Error getMyAccountDeletionStatus:', error);
    res.status(500).json({ success: false, message: 'Gagal memuat status penghapusan akun.', error: error.message });
  }
};

export const submitAccountDeletion = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureModerationTables();
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    const { reason, password, confirm_email } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Silakan masuk terlebih dahulu.' });
      return;
    }

    if (!reason || !String(reason).trim()) {
      res.status(400).json({ success: false, message: 'Alasan penghapusan akun wajib dipilih.' });
      return;
    }

    const [uRows]: any = await pool.query(
      'SELECT id, name, email, password_hash FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (!uRows || uRows.length === 0) {
      res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' });
      return;
    }
    const user = uRows[0];

    // 1. Cek apakah sudah ada pengajuan berstatus pending
    const [existingPending]: any = await pool.query(
      "SELECT id FROM account_deletions WHERE (user_id = ? OR email = ?) AND status = 'pending' LIMIT 1",
      [user.id, user.email]
    );
    if (existingPending && existingPending.length > 0) {
      res.status(409).json({
        success: false,
        message: 'Anda sudah memiliki pengajuan penghapusan akun yang sedang menunggu peninjauan Admin.',
      });
      return;
    }

    // 2. Cek apakah masih memiliki pesanan aktif yang belum selesai
    const [activeOrders]: any = await pool.query(
      "SELECT COUNT(*) AS cnt FROM orders WHERE user_id = ? AND status IN ('pending', 'paid', 'packed', 'shipped')",
      [user.id]
    );
    if (Number(activeOrders?.[0]?.cnt ?? 0) > 0) {
      res.status(400).json({
        success: false,
        message: 'Selesaikan atau batalkan pesanan aktif Anda terlebih dahulu sebelum mengajukan penghapusan akun.',
      });
      return;
    }

    // 3. Verifikasi keamanan identitas (password untuk akun reguler, konfirmasi email untuk akun Google OAuth)
    if (user.password_hash) {
      if (!password || !String(password).trim()) {
        res.status(400).json({
          success: false,
          message: 'Kata sandi wajib diisi untuk mengonfirmasi penghapusan akun.',
        });
        return;
      }
      const isPassValid = await bcrypt.compare(String(password), user.password_hash);
      if (!isPassValid) {
        res.status(400).json({
          success: false,
          message: 'Kata sandi konfirmasi salah.',
        });
        return;
      }
    } else {
      const cleanConfirmEmail = String(confirm_email || '').trim().toLowerCase();
      if (!cleanConfirmEmail || cleanConfirmEmail !== String(user.email).trim().toLowerCase()) {
        res.status(400).json({
          success: false,
          message: 'Ketik alamat email akun Anda dengan benar untuk mengonfirmasi penghapusan akun.',
        });
        return;
      }
    }

    const [result]: any = await pool.query(
      `INSERT INTO account_deletions (user_id, name, email, reason, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [user.id, user.name || 'Pengguna', user.email, String(reason).trim()]
    );

    res.status(201).json({
      success: true,
      message: 'Pengajuan penghapusan akun berhasil dikirim dan sedang menunggu peninjauan Admin.',
      data: {
        id: result.insertId,
        status: 'pending',
        reason: String(reason).trim(),
        created_at: new Date().toISOString(),
      },
      requestId: result.insertId,
    });
  } catch (error: any) {
    console.error('Error submitAccountDeletion:', error);
    res.status(500).json({ success: false, message: 'Gagal mengajukan penghapusan akun', error: error.message });
  }
};

export const cancelMyAccountDeletion = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureModerationTables();
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const [uRows]: any = await pool.query('SELECT email FROM users WHERE id = ? LIMIT 1', [userId]);
    const userEmail = uRows?.[0]?.email || '';

    const [result]: any = await pool.query(
      "DELETE FROM account_deletions WHERE (user_id = ? OR email = ?) AND status = 'pending'",
      [userId, userEmail]
    );

    if (!result?.affectedRows) {
      res.status(404).json({
        success: false,
        message: 'Tidak ada pengajuan penghapusan akun berstatus menunggu yang dapat dibatalkan.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Pengajuan penghapusan akun berhasil dibatalkan.',
    });
  } catch (error: any) {
    console.error('Error cancelMyAccountDeletion:', error);
    res.status(500).json({ success: false, message: 'Gagal membatalkan pengajuan penghapusan akun.', error: error.message });
  }
};
