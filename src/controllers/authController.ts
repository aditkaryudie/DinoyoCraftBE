// ============================================================
//  src/controllers/authController.ts
//  Controller Autentikasi — Register, Login, Logout, Profile
// ============================================================

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import {
  sendSuccess,
  sendCreated,
  sendBadRequest,
  sendUnauthorized,
  sendNotFound,
  sendError,
} from '../utils/response.js';
import {
  RegisterDto,
  LoginDto,
  UserEntity,
  SafeUser,
  JwtPayload,
} from '../types/index.js';
import { getAuthLocals } from '../middlewares/authMiddleware.js';

const JWT_SECRET = process.env['JWT_SECRET'] as string;
const JWT_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] ?? '7d';

/**
 * Hapus field sensitif dari objek user sebelum dikembalikan ke client
 */
const sanitizeUser = (user: UserEntity): SafeUser => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, token_version, ...safe } = user;
  return safe as SafeUser;
};

/**
 * POST /api/auth/register
 */
export const register = async (_req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role = 'mitra' } = res.locals['body'] as RegisterDto
      || _req.body as RegisterDto;
    const body = _req.body as RegisterDto;

    // Cek apakah email sudah digunakan
    const [existing] = await pool.execute<UserEntity[]>(
      'SELECT id FROM users WHERE email = ?',
      [body.email]
    );

    if (existing.length > 0) {
      sendBadRequest(res, 'Email sudah terdaftar. Gunakan email lain.');
      return;
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(body.password, saltRounds);

    // Simpan ke database
    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password_hash, role, is_active, token_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, TRUE, 0, NOW(), NOW())`,
      [body.name, body.email, passwordHash, body.role ?? 'mitra']
    );

    const insertId = (result as { insertId: number }).insertId;

    // Ambil data user yang baru dibuat
    const [rows] = await pool.execute<UserEntity[]>(
      'SELECT * FROM users WHERE id = ?',
      [insertId]
    );

    const newUser = rows[0];
    if (!newUser) {
      sendError(res, 'Gagal membuat akun. Coba lagi.');
      return;
    }

    // Suppress unused variable warnings from destructuring
    void name; void email; void password; void role;

    sendCreated(res, sanitizeUser(newUser), 'Akun berhasil dibuat.');
  } catch (err) {
    sendError(res, 'Terjadi kesalahan saat registrasi.', 500, String(err));
  }
};

/**
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as LoginDto;

    // Cari user berdasarkan email
    const [rows] = await pool.execute<UserEntity[]>(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
      [email]
    );

    const user = rows[0];

    if (!user) {
      sendUnauthorized(res, 'Email atau password salah.');
      return;
    }

    // Verifikasi password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      sendUnauthorized(res, 'Email atau password salah.');
      return;
    }

    // Buat JWT
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    sendSuccess(
      res,
      { user: sanitizeUser(user), token },
      'Login berhasil.'
    );
  } catch (err) {
    sendError(res, 'Terjadi kesalahan saat login.', 500, String(err));
  }
};

/**
 * GET /api/auth/profile
 * Protected route — membutuhkan verifyToken
 */
export const getProfile = async (_req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = getAuthLocals(res);

    const [rows] = await pool.execute<UserEntity[]>(
      'SELECT * FROM users WHERE id = ? AND is_active = TRUE',
      [userId]
    );

    const user = rows[0];

    if (!user) {
      sendNotFound(res, 'Pengguna tidak ditemukan.');
      return;
    }

    sendSuccess(res, sanitizeUser(user), 'Data profil berhasil diambil.');
  } catch (err) {
    sendError(res, 'Gagal mengambil profil.', 500, String(err));
  }
};

/**
 * POST /api/auth/logout
 */
export const logout = async (_req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = getAuthLocals(res);

    await pool.execute(
      'UPDATE users SET token_version = token_version + 1, updated_at = NOW() WHERE id = ?',
      [userId]
    );

    sendSuccess(res, null, 'Logout berhasil.');
  } catch (err) {
    sendError(res, 'Gagal logout.', 500, String(err));
  }
};


