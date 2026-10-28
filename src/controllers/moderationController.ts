// ============================================================
//  src/controllers/moderationController.ts
//  Controller Moderasi & Keamanan (Admin Only)
// ============================================================

import { Request, Response } from 'express';
import pool from '../config/database.js';

let tablesInitialized = false;

/**
 * Memastikan tabel reports dan account_deletions tersedia di database
 */
const ensureModerationTables = async (): Promise<void> => {
  if (tablesInitialized) return;
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

    // Cek apakah tabel reports masih kosong, jika ya isi sampel awal
    const [reportCount]: any = await pool.query('SELECT COUNT(*) as total FROM reports');
    if (reportCount[0]?.total === 0) {
      await pool.query(`
        INSERT INTO \`reports\` (\`id\`, \`type\`, \`target_name\`, \`reporter_name\`, \`reason\`, \`status\`, \`created_at\`) VALUES
        (1, 'toko', 'Tanah Liat Art', 'Budi Santoso', 'Melanggar ketentuan harga (price dumping)', 'pending', DATE_SUB(NOW(), INTERVAL 2 DAY)),
        (2, 'ulasan', 'Review oleh User123 di Mug Daun', 'Siti Rahayu', 'Ulasan mengandung kata kasar', 'pending', DATE_SUB(NOW(), INTERVAL 3 DAY)),
        (3, 'produk', 'Asbak Bentuk Tangan (Studio Bumi)', 'Joko Santoso', 'Gambar tidak sesuai produk asli', 'pending', DATE_SUB(NOW(), INTERVAL 4 DAY)),
        (4, 'toko', 'Keramik Murah Meriah', 'Dewi Kartika', 'Foto produk menggunakan gambar curian', 'pending', DATE_SUB(NOW(), INTERVAL 6 DAY)),
        (5, 'ulasan', 'Review di Piring Hias (Keramik Rina)', 'Ahmad Fauzi', 'Ulasan palsu & tidak relevan', 'resolved', DATE_SUB(NOW(), INTERVAL 8 DAY));
      `);
    }

    // Cek apakah tabel account_deletions masih kosong, jika ya isi sampel awal
    const [delCount]: any = await pool.query('SELECT COUNT(*) as total FROM account_deletions');
    if (delCount[0]?.total === 0) {
      await pool.query(`
        INSERT INTO \`account_deletions\` (\`id\`, \`name\`, \`email\`, \`reason\`, \`status\`, \`created_at\`) VALUES
        (1, 'Rina Kusuma', 'rina.k@gmail.com', 'Tidak ingin menggunakan platform lagi', 'pending', DATE_SUB(NOW(), INTERVAL 1 DAY)),
        (2, 'Denny Prasetyo', 'denny.p@yahoo.com', 'Pindah ke platform lain', 'pending', DATE_SUB(NOW(), INTERVAL 2 DAY)),
        (3, 'Mega Wulandari', 'mega.w@gmail.com', 'Privasi data — ingin semua data dihapus', 'approved', DATE_SUB(NOW(), INTERVAL 4 DAY)),
        (4, 'Farhan Aziz', 'farhan.a@email.com', 'Akun duplikat, sudah punya akun lain', 'rejected', DATE_SUB(NOW(), INTERVAL 6 DAY)),
        (5, 'Laila Novita', 'laila.n@gmail.com', 'Sudah tidak aktif bertransaksi', 'pending', DATE_SUB(NOW(), INTERVAL 7 DAY));
      `);
    }

    tablesInitialized = true;
  } catch (err) {
    console.warn('⚠️ [ensureModerationTables] Inisialisasi tabel:', err);
  }
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
          'UPDATE mitra_profiles SET is_active = 0 WHERE id = ? OR user_id = ?',
          [targetEntityId, targetEntityId]
        );
      }
    } else if ((actionType === 'hapus' || actionType === 'delete') && (reportType === 'ulasan' || reportType === 'review')) {
      if (targetEntityId) {
        try {
          await pool.query('DELETE FROM reviews WHERE id = ?', [targetEntityId]);
        } catch {
          // Abaikan jika tabel reviews belum terpasang
        }
      }
    } else if (actionType === 'suspend' && (reportType === 'produk' || reportType === 'product')) {
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

    // Jika disetujui, nonaktifkan akun pengguna di tabel users
    if (action === 'approved') {
      if (delReq.user_id) {
        await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [delReq.user_id]);
      } else if (delReq.email) {
        await pool.query('UPDATE users SET is_active = 0 WHERE email = ?', [delReq.email]);
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
