// ============================================================
//  src/controllers/adminController.ts
//  Controller Admin — manajemen user dan master data
// ============================================================

import { Request, Response } from 'express';
import pool from '../config/database.js';
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
    const { status } = req.body as { status: 'approved' | 'rejected' };

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
    const isVerifiedVal = isApproved ? 1 : 0;
    const isActiveVal = isApproved ? 1 : 0;

    // Update status di tabel mitra_profiles
    await pool.execute(
      'UPDATE mitra_profiles SET is_verified = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
      [isVerifiedVal, isActiveVal, mitraId]
    );

    // Update status akun user di tabel users
    await pool.execute(
      'UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?',
      [isActiveVal, userId]
    );

    const message = isApproved
      ? 'Toko mitra berhasil disetujui.'
      : 'Pengajuan toko mitra telah ditolak.';

    sendSuccess(res, { mitraId, status }, message);
  } catch (err) {
    sendError(res, 'Gagal memproses verifikasi toko mitra.', 500, String(err));
  }
};