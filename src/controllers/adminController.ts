// ============================================================
//  src/controllers/adminController.ts
//  Controller Admin — manajemen user, toko, transaksi, kategori, jadwal, dan master data
// ============================================================

import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/database.js';
import {
  sendSuccess,
  sendError,
  sendNotFound,
  sendBadRequest,
} from '../utils/response.js';
import {
  SafeUser,
  CreateMasterDataDto,
  CountResult,
} from '../types/index.js';
import { getAuthLocals } from '../middlewares/authMiddleware.js';

const sanitizeUser = (user: any): SafeUser => {
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
    const [tokoAktifRows] = await pool.execute<any[]>(
      'SELECT COUNT(*) AS total FROM mitra_profiles WHERE is_verified = 1 AND is_active = 1'
    );
    const tokoPengrajinAktif = Number(tokoAktifRows[0]?.total ?? 0);

    const [tokoPendingRows] = await pool.execute<any[]>(
      'SELECT COUNT(*) AS total FROM mitra_profiles WHERE is_verified = 0'
    );
    const pengajuanTokoBaru = Number(tokoPendingRows[0]?.total ?? 0);

    const [orderStatsRows] = await pool.execute<any[]>(
      `SELECT 
        COUNT(*) AS totalTransaksi,
        COALESCE(SUM(total_amount), 0) AS totalOmzet
       FROM orders
       WHERE status != 'cancelled'`
    );
    let totalTransaksi = Number(orderStatsRows[0]?.totalTransaksi ?? 0);
    let totalOmzet = Number(orderStatsRows[0]?.totalOmzet ?? 0);

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

    const [visitorRows] = await pool.execute<any[]>(
      `SELECT COUNT(DISTINCT ip_address) AS total FROM audit_logs WHERE ip_address IS NOT NULL`
    );
    let kunjunganWisatawan = Number(visitorRows[0]?.total ?? 0);
    if (kunjunganWisatawan === 0) {
      const [userCountRows] = await pool.execute<any[]>(
        `SELECT COUNT(*) AS total FROM users WHERE role IN ('pengunjung', 'buyer')`
      );
      kunjunganWisatawan = Number(userCountRows[0]?.total ?? 0);
    }

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

    res.status(200).json({
      success: true,
      data: {
        totalTransaksi,
        totalOmzet,
        kunjunganWisatawan,
        tokoPengrajinAktif,
        pengajuanTokoBaru,
        transaksiTerbaru
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
  }
};

/**
 * GET /api/admin/transactions
 * Daftar seluruh transaksi lintas toko (dari tabel orders & transactions)
 */
export const getAdminTransactions = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [orderRows]: any = await pool.query(
      `SELECT 
        o.id,
        o.created_at,
        o.total_amount,
        o.total_due,
        o.status,
        o.tracking_number,
        COALESCE(m.store_name, 'Toko Mitra') AS store_name,
        COALESCE(u.name, 'Pelanggan') AS buyer_name,
        t.reference_code,
        t.status AS payment_status
       FROM orders o
       LEFT JOIN mitra_profiles m ON o.mitra_id = m.id
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN transactions t ON t.order_id = o.id
       ORDER BY o.created_at DESC`
    );

    const mapped = (orderRows || []).map((row: any) => {
      const d = row.created_at ? new Date(row.created_at) : new Date();
      const tanggal = d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const rawStatus = String(row.status || '').toLowerCase();
      let statusLabel: 'Berhasil' | 'Menunggu' | 'Dibatalkan' = 'Menunggu';
      if (['paid', 'packed', 'shipped', 'completed', 'selesai', 'delivered'].includes(rawStatus)) {
        statusLabel = 'Berhasil';
      } else if (rawStatus === 'cancelled') {
        statusLabel = 'Dibatalkan';
      }

      const invoiceId =
        row.reference_code ||
        `INV/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(row.id).padStart(4, '0')}`;

      return {
        rawId: row.id,
        order_id: row.id,
        id: invoiceId,
        tanggal,
        toko: row.store_name,
        pembeli: row.buyer_name,
        nominal: Number(row.total_amount || row.total_due || 0),
        status: statusLabel,
        orderStatus: row.status
      };
    });

    res.status(200).json({
      success: true,
      data: mapped
    });
  } catch (error) {
    console.error('Error getAdminTransactions:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data transaksi' });
  }
};

/**
 * GET /api/admin/users
 */
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
    const limit = Math.min(200, parseInt(req.query['limit'] as string) || 100);
    const offset = (page - 1) * limit;

    const [rows]: any = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.updated_at,
              m.store_name
       FROM users u
       LEFT JOIN mitra_profiles m ON u.id = m.user_id
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [countRows] = await pool.execute<CountResult[]>(
      'SELECT COUNT(*) as total FROM users'
    );

    const total = countRows[0]?.total ?? 0;

    sendSuccess(res, rows.map(sanitizeUser), 'Daftar pengguna berhasil diambil.', 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    sendError(res, 'Gagal mengambil data pengguna.', 500, String(err));
  }
};

/**
 * POST /api/admin/users
 */
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role = 'pengunjung', store_name } = req.body;
    if (!name || !email) {
      sendBadRequest(res, 'Nama dan email wajib diisi.');
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const [existing]: any = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
    if (existing && existing.length > 0) {
      res.status(409).json({ success: false, message: 'Email sudah terdaftar.' });
      return;
    }

    const normalizedRole =
      String(role).toLowerCase() === 'admin'
        ? 'admin'
        : String(role).toLowerCase() === 'mitra'
        ? 'mitra'
        : 'pengunjung';

    const passwordHash = await bcrypt.hash(password || 'DinoyoCraft123', 10);
    const [result]: any = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, NOW(), NOW())',
      [name.trim(), normalizedEmail, passwordHash, normalizedRole]
    );

    const newUserId = result.insertId;
    if (normalizedRole === 'mitra') {
      await pool.query(
        `INSERT INTO mitra_profiles (user_id, store_name, whatsapp_number, workshop_address, ktp_file_url, nib_file_url, sample_product_images, is_verified, is_active)
         VALUES (?, ?, '-', '-', '', '', '[]', 1, 1)`,
        [newUserId, store_name || `Toko ${name.trim()}`]
      );
    }

    sendSuccess(
      res,
      {
        id: newUserId,
        name: name.trim(),
        email: normalizedEmail,
        role: normalizedRole,
        is_active: 1,
        store_name: normalizedRole === 'mitra' ? store_name || `Toko ${name.trim()}` : null
      },
      'Pengguna baru berhasil ditambahkan.',
      201
    );
  } catch (err) {
    sendError(res, 'Gagal menambahkan pengguna.', 500, String(err));
  }
};

/**
 * PUT /api/admin/users/:id
 */
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt((req.params as { id: string }).id ?? '0');
    const { name, email, role, is_active, store_name } = req.body;

    const normalizedRole = role
      ? String(role).toLowerCase() === 'admin'
        ? 'admin'
        : String(role).toLowerCase() === 'mitra'
        ? 'mitra'
        : 'pengunjung'
      : null;

    await pool.query(
      `UPDATE users
       SET name = COALESCE(?, name),
           email = COALESCE(?, email),
           role = COALESCE(?, role),
           is_active = COALESCE(?, is_active),
           updated_at = NOW()
       WHERE id = ?`,
      [
        name ?? null,
        email ? String(email).trim().toLowerCase() : null,
        normalizedRole,
        typeof is_active === 'boolean' ? (is_active ? 1 : 0) : is_active ?? null,
        userId
      ]
    );

    if (store_name) {
      await pool.query(
        'UPDATE mitra_profiles SET store_name = ? WHERE user_id = ?',
        [store_name, userId]
      );
    }

    sendSuccess(res, { id: userId, name, email, role: normalizedRole }, 'Data pengguna berhasil diperbarui.');
  } catch (err) {
    sendError(res, 'Gagal memperbarui data pengguna.', 500, String(err));
  }
};

/**
 * DELETE /api/admin/users/:id
 */
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt((req.params as { id: string }).id ?? '0');
    await pool.query('UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?', [userId]);
    sendSuccess(res, { id: userId }, 'Pengguna berhasil dihapus/dinonaktifkan.');
  } catch (err) {
    sendError(res, 'Gagal menghapus pengguna.', 500, String(err));
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
 * Mendapatkan daftar semua pengajuan verifikasi & manajemen toko mitra
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
        u.email,
        (SELECT COUNT(*) FROM products p WHERE p.mitra_id = m.id AND (p.is_deleted = 0 OR p.is_deleted IS NULL)) AS total_products
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

    await pool.execute(
      'UPDATE mitra_profiles SET is_verified = ?, is_active = 1, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
      [isVerifiedVal, rejectionReason, mitraId]
    );

    await pool.execute(
      'UPDATE users SET is_active = 1, updated_at = NOW() WHERE id = ?',
      [userId]
    );

    sendSuccess(
      res,
      { id: mitraId, user_id: userId, status, is_verified: isVerifiedVal, rejection_reason: rejectionReason },
      isApproved ? 'Toko mitra berhasil disetujui dan diaktifkan.' : 'Pengajuan toko mitra berhasil ditolak.'
    );
  } catch (err) {
    sendError(res, 'Gagal memproses verifikasi toko mitra.', 500, String(err));
  }
};

/**
 * PATCH /api/admin/stores/:id/status
 * Aktifkan / suspend toko mitra
 */
export const updateStoreStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const mitraId = parseInt((req.params as { id: string }).id ?? '0');
    const { is_active } = req.body;
    const activeVal = is_active ? 1 : 0;

    await pool.query(
      'UPDATE mitra_profiles SET is_active = ?, updated_at = NOW() WHERE id = ?',
      [activeVal, mitraId]
    );

    sendSuccess(res, { id: mitraId, is_active: activeVal }, 'Status operasional toko berhasil diperbarui.');
  } catch (err) {
    sendError(res, 'Gagal memperbarui status toko.', 500, String(err));
  }
};

/**
 * DELETE /api/admin/stores/:id
 */
export const deleteStore = async (req: Request, res: Response): Promise<void> => {
  try {
    const mitraId = parseInt((req.params as { id: string }).id ?? '0');
    await pool.query('UPDATE mitra_profiles SET is_active = 0, updated_at = NOW() WHERE id = ?', [mitraId]);
    sendSuccess(res, { id: mitraId }, 'Toko mitra berhasil dinonaktifkan.');
  } catch (err) {
    sendError(res, 'Gagal menghapus toko mitra.', 500, String(err));
  }
};

/**
 * GET /api/admin/categories
 */
export const getCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows]: any = await pool.query(
      `SELECT c.id, c.name, c.description, c.icon_url, c.created_at,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND (p.is_deleted = 0 OR p.is_deleted IS NULL)) AS total_products
       FROM categories c
       ORDER BY c.id ASC`
    );
    sendSuccess(res, rows, 'Daftar kategori berhasil diambil.');
  } catch (err) {
    sendError(res, 'Gagal mengambil daftar kategori.', 500, String(err));
  }
};

/**
 * POST /api/admin/categories
 */
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, icon_url } = req.body;
    if (!name || !String(name).trim()) {
      sendBadRequest(res, 'Nama kategori wajib diisi.');
      return;
    }

    const [result]: any = await pool.query(
      'INSERT INTO categories (name, description, icon_url, created_at) VALUES (?, ?, ?, NOW())',
      [String(name).trim(), description || null, icon_url || null]
    );

    sendSuccess(
      res,
      {
        id: result.insertId,
        name: String(name).trim(),
        description: description || '',
        total_products: 0
      },
      'Kategori berhasil ditambahkan.',
      201
    );
  } catch (err) {
    sendError(res, 'Gagal menambahkan kategori.', 500, String(err));
  }
};

/**
 * PUT /api/admin/categories/:id
 */
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const catId = parseInt((req.params as { id: string }).id ?? '0');
    const { name, description, icon_url } = req.body;

    await pool.query(
      `UPDATE categories
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           icon_url = COALESCE(?, icon_url)
       WHERE id = ?`,
      [name ?? null, description ?? null, icon_url ?? null, catId]
    );

    sendSuccess(res, { id: catId, name, description }, 'Kategori berhasil diperbarui.');
  } catch (err) {
    sendError(res, 'Gagal memperbarui kategori.', 500, String(err));
  }
};

/**
 * DELETE /api/admin/categories/:id
 */
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const catId = parseInt((req.params as { id: string }).id ?? '0');
    await pool.query('DELETE FROM categories WHERE id = ?', [catId]);
    sendSuccess(res, { id: catId }, 'Kategori berhasil dihapus.');
  } catch (err) {
    sendError(res, 'Gagal menghapus kategori.', 500, String(err));
  }
};

/**
 * GET /api/admin/schedules
 * Menggunakan tabel educational_tours
 */
export const getSchedules = async (_req: Request, res: Response): Promise<void> => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`visit_schedules\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`agency_name\` varchar(255) NOT NULL,
        \`visit_date\` date NOT NULL,
        \`visit_time\` time DEFAULT '09:00:00',
        \`participant_count\` int DEFAULT 1,
        \`pic_name\` varchar(150) DEFAULT '-',
        \`pic_phone\` varchar(50) DEFAULT '-',
        \`status\` varchar(50) DEFAULT 'pending',
        \`notes\` text DEFAULT NULL,
        \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    let [rows]: any = await pool.query('SELECT * FROM visit_schedules ORDER BY visit_date ASC, id DESC');

    if (!rows || rows.length === 0) {
      // Seed 3 jadwal kunjungan awal secara idempotent jika tabel masih kosong
      await pool.query(
        `INSERT INTO visit_schedules (agency_name, visit_date, visit_time, participant_count, pic_name, pic_phone, status, notes, created_at, updated_at)
         VALUES
         ('SMAN 1 Malang', '2026-04-20', '09:00:00', 45, 'Budi Santoso', '081234567890', 'approved', 'Mitra: Keramik Jaya Abadi', NOW(), NOW()),
         ('Universitas Brawijaya (FIB)', '2026-04-25', '13:00:00', 30, 'Dr. Siti Aminah', '081298765432', 'pending', 'Mitra: Galeri Tanah Liat', NOW(), NOW()),
         ('SDN Dinoyo 2', '2026-03-10', '08:00:00', 60, 'Ibu Ratna', '085611223344', 'completed', 'Mitra: Dinoyo Craft Studio', NOW(), NOW())`
      );
      [rows] = await pool.query('SELECT * FROM visit_schedules ORDER BY visit_date ASC, id DESC');
    }

    const mapped = (rows || []).map((r: any) => {
      const dateStr = r.visit_date
        ? new Date(r.visit_date).toISOString().split('T')[0]
        : '2026-04-20';
      const timeStr = r.visit_time ? String(r.visit_time).slice(0, 5) + ' WIB' : '09:00 WIB';
      const rawStatus = String(r.status || 'pending').toLowerCase();
      let uiStatus: 'Terjadwal' | 'Menunggu Konfirmasi' | 'Selesai' | 'Dibatalkan' = 'Menunggu Konfirmasi';
      if (rawStatus === 'approved' || rawStatus === 'terjadwal') uiStatus = 'Terjadwal';
      else if (rawStatus === 'completed' || rawStatus === 'selesai') uiStatus = 'Selesai';
      else if (rawStatus === 'rejected' || rawStatus === 'cancelled' || rawStatus === 'dibatalkan') uiStatus = 'Dibatalkan';

      const notesStr = String(r.notes || '');
      const mitraMatch = notesStr.startsWith('Mitra:')
        ? notesStr.replace('Mitra:', '').trim()
        : notesStr || 'Keramik Jaya Abadi';

      return {
        rawId: r.id,
        id: `SCH-${String(r.id).padStart(3, '0')}`,
        instansi: r.agency_name,
        pic: r.pic_name,
        telepon: r.pic_phone,
        tanggal: dateStr,
        waktu: timeStr,
        peserta: Number(r.participant_count || 0),
        mitraTujuan: mitraMatch,
        status: uiStatus
      };
    });

    sendSuccess(res, mapped, 'Daftar jadwal kunjungan edukasi berhasil diambil.');
  } catch (err) {
    sendError(res, 'Gagal mengambil jadwal kunjungan.', 500, String(err));
  }
};

/**
 * POST /api/admin/schedules
 */
export const createSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { instansi, pic, telepon, tanggal, waktu, peserta, mitraTujuan, status } = req.body;
    if (!instansi || !tanggal) {
      sendBadRequest(res, 'Nama instansi dan tanggal wajib diisi.');
      return;
    }

    const cleanTime = waktu ? String(waktu).replace(' WIB', '').trim() + ':00' : '09:00:00';
    let dbStatus = 'pending';
    if (status === 'Terjadwal' || status === 'approved') dbStatus = 'approved';
    else if (status === 'Selesai' || status === 'completed') dbStatus = 'completed';
    else if (status === 'Dibatalkan' || status === 'rejected') dbStatus = 'rejected';

    const [result]: any = await pool.query(
      `INSERT INTO visit_schedules (agency_name, visit_date, visit_time, participant_count, pic_name, pic_phone, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        instansi,
        tanggal,
        cleanTime.slice(0, 8),
        Number(peserta || 1),
        pic || '-',
        telepon || '-',
        dbStatus,
        `Mitra: ${mitraTujuan || 'Keramik Jaya Abadi'}`
      ]
    );

    sendSuccess(
      res,
      {
        rawId: result.insertId,
        id: `SCH-${String(result.insertId).padStart(3, '0')}`,
        instansi,
        pic,
        telepon,
        tanggal,
        waktu: waktu || '09:00 WIB',
        peserta: Number(peserta || 1),
        mitraTujuan: mitraTujuan || 'Keramik Jaya Abadi',
        status: status || 'Terjadwal'
      },
      'Jadwal kunjungan berhasil ditambahkan.',
      201
    );
  } catch (err) {
    sendError(res, 'Gagal membuat jadwal kunjungan.', 500, String(err));
  }
};

/**
 * PUT /api/admin/schedules/:id
 */
export const updateSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = String((req.params as { id: string }).id || '');
    const numericId = parseInt(rawId.replace(/\D/g, ''), 10);
    const { instansi, pic, telepon, tanggal, waktu, peserta, mitraTujuan, status } = req.body;

    const cleanTime = waktu ? String(waktu).replace(' WIB', '').trim() + ':00' : null;
    let dbStatus: string | null = null;
    if (status === 'Terjadwal' || status === 'approved') dbStatus = 'approved';
    else if (status === 'Menunggu Konfirmasi' || status === 'pending') dbStatus = 'pending';
    else if (status === 'Selesai' || status === 'completed') dbStatus = 'completed';
    else if (status === 'Dibatalkan' || status === 'rejected') dbStatus = 'rejected';

    await pool.query(
      `UPDATE visit_schedules
       SET agency_name = COALESCE(?, agency_name),
           pic_name = COALESCE(?, pic_name),
           pic_phone = COALESCE(?, pic_phone),
           visit_date = COALESCE(?, visit_date),
           visit_time = COALESCE(?, visit_time),
           participant_count = COALESCE(?, participant_count),
           notes = COALESCE(?, notes),
           status = COALESCE(?, status),
           updated_at = NOW()
       WHERE id = ?`,
      [
        instansi ?? null,
        pic ?? null,
        telepon ?? null,
        tanggal ?? null,
        cleanTime ? cleanTime.slice(0, 8) : null,
        peserta !== undefined ? Number(peserta) : null,
        mitraTujuan ? `Mitra: ${mitraTujuan}` : null,
        dbStatus,
        numericId
      ]
    );

    sendSuccess(res, { id: rawId, rawId: numericId, status }, 'Jadwal kunjungan berhasil diperbarui.');
  } catch (err) {
    sendError(res, 'Gagal memperbarui jadwal kunjungan.', 500, String(err));
  }
};

/**
 * DELETE /api/admin/schedules/:id
 */
export const deleteSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = String((req.params as { id: string }).id || '');
    const numericId = parseInt(rawId.replace(/\D/g, ''), 10);
    await pool.query('DELETE FROM visit_schedules WHERE id = ?', [numericId]);
    sendSuccess(res, { id: rawId }, 'Jadwal kunjungan berhasil dihapus.');
  } catch (err) {
    sendError(res, 'Gagal menghapus jadwal kunjungan.', 500, String(err));
  }
};
