// ============================================================
//  src/controllers/authController.ts
//  Controller Autentikasi — Register, Login, Logout, Profile, Google OAuth
// ============================================================

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
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
const googleClient = new OAuth2Client(process.env['GOOGLE_CLIENT_ID']);

/** Buat JWT dari data user */
const signToken = (user: UserEntity): string => {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

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
 * Handle user registration with shop data and document uploads for mitra
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as RegisterDto & {
      shop_name?: string;
      address?: string;
      phone?: string;
      year_started?: number;
    };

    const { name, email, password, role = 'mitra' } = body;

    // Cek apakah email sudah digunakan
    const [existing] = await pool.execute<UserEntity[]>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      sendBadRequest(res, 'Email sudah terdaftar. Gunakan email lain.');
      return;
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Simpan user ke database
    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password_hash, role, is_active, token_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, TRUE, 0, NOW(), NOW())`,
      [name, email, passwordHash, role ?? 'mitra']
    );

    const userId = (result as { insertId: number }).insertId;
    console.log(`✅ User created: ID=${userId}, Email=${email}`);

    // Jika role adalah mitra dan ada shop data, simpan ke tabel shops
    if ((role ?? 'mitra') === 'mitra' && body.shop_name) {
      try {
        await pool.execute(
          `INSERT INTO shops (user_id, shop_name, address, phone, year_started, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          [userId, body.shop_name, body.address || '', body.phone || '', body.year_started || new Date().getFullYear()]
        );
      } catch (shopErr) {
        console.error('Error saving shop data:', shopErr);
        // Jangan gagalkan registrasi jika shop data gagal
      }
    }

    // Ambil data user yang baru dibuat
    const [rows] = await pool.execute<UserEntity[]>(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    const newUser = rows[0];
    if (!newUser) {
      sendError(res, 'Gagal membuat akun. Coba lagi.');
      return;
    }

    // Buat JWT untuk user baru
    const token = signToken(newUser);

    sendCreated(res, { user: sanitizeUser(newUser), token }, 'Akun berhasil dibuat.');
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
    const token = signToken(user);

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

/**
 * POST /api/auth/upload-documents
 * Upload dokumen registrasi untuk mitra (KTP, NIB, foto produk)
 * Expects multipart/form-data dengan fields: ktp, nib, product_photos[]
 */
export const uploadRegistrationDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = getAuthLocals(res);

    // Validasi files
    const files = req.files as { [key: string]: Express.Multer.File[] } | undefined;
    if (!files || Object.keys(files).length === 0) {
      sendBadRequest(res, 'Tidak ada file yang diunggah.');
      return;
    }

    const uploadedDocs: Array<{ type: string; path: string; size: number; mime: string }> = [];

    // Process KTP
    if (files.ktp && files.ktp[0]) {
      const file = files.ktp[0];
      const docPath = `/uploads/documents/${userId}/ktp-${Date.now()}-${file.originalname}`;
      
      await pool.execute(
        `INSERT INTO registration_documents (user_id, document_type, file_name, file_path, file_size, mime_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [userId, 'ktp', file.originalname, docPath, file.size, file.mimetype]
      );
      uploadedDocs.push({ type: 'ktp', path: docPath, size: file.size, mime: file.mimetype });
    }

    // Process NIB
    if (files.nib && files.nib[0]) {
      const file = files.nib[0];
      const docPath = `/uploads/documents/${userId}/nib-${Date.now()}-${file.originalname}`;
      
      await pool.execute(
        `INSERT INTO registration_documents (user_id, document_type, file_name, file_path, file_size, mime_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [userId, 'nib', file.originalname, docPath, file.size, file.mimetype]
      );
      uploadedDocs.push({ type: 'nib', path: docPath, size: file.size, mime: file.mimetype });
    }

    // Process Product Photos
    if (files.product_photos && files.product_photos.length > 0) {
      for (const file of files.product_photos) {
        const docPath = `/uploads/documents/${userId}/product-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${file.originalname}`;
        
        await pool.execute(
          `INSERT INTO registration_documents (user_id, document_type, file_name, file_path, file_size, mime_type, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [userId, 'product_photo', file.originalname, docPath, file.size, file.mimetype]
        );
        uploadedDocs.push({ type: 'product_photo', path: docPath, size: file.size, mime: file.mimetype });
      }
    }

    if (uploadedDocs.length === 0) {
      sendBadRequest(res, 'Gagal menyimpan dokumen. Coba lagi.');
      return;
    }

    sendSuccess(res, { documents: uploadedDocs, count: uploadedDocs.length }, 'Dokumen berhasil diunggah.');
  } catch (err) {
    sendError(res, 'Terjadi kesalahan saat upload dokumen.', 500, String(err));
  }
};
export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential } = req.body as { credential?: string };

    if (!credential) {
      sendBadRequest(res, 'Google credential wajib dikirimkan.');
      return;
    }

    // Verifikasi token dari Google
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env['GOOGLE_CLIENT_ID'],
      });
    } catch {
      sendUnauthorized(res, 'Google credential tidak valid atau sudah kedaluwarsa.');
      return;
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      sendUnauthorized(res, 'Data Google tidak lengkap.');
      return;
    }

    const { email, name, sub: googleId } = payload;

    // Cari user dengan email tersebut
    const [rows] = await pool.execute<UserEntity[]>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    let user = rows[0];

    if (user) {
      // User sudah ada — pastikan aktif
      if (!user.is_active) {
        sendUnauthorized(res, 'Akun kamu tidak aktif. Hubungi admin.');
        return;
      }

      // Simpan google_id jika belum ada (kolom opsional)
      if (!(user as UserEntity & { google_id?: string }).google_id && googleId) {
        await pool.execute(
          'UPDATE users SET updated_at = NOW() WHERE id = ?',
          [user.id]
        );
      }
    } else {
      // User belum ada — buat akun baru (tanpa password)
      const [result] = await pool.execute(
        `INSERT INTO users (name, email, password_hash, role, is_active, token_version, created_at, updated_at)
         VALUES (?, ?, '', 'mitra', TRUE, 0, NOW(), NOW())`,
        [name ?? email.split('@')[0], email]
      );

      const insertId = (result as { insertId: number }).insertId;
      const [newRows] = await pool.execute<UserEntity[]>(
        'SELECT * FROM users WHERE id = ?',
        [insertId]
      );
      user = newRows[0];

      if (!user) {
        sendError(res, 'Gagal membuat akun Google.');
        return;
      }
    }

    const token = signToken(user);
    const isNewUser = rows.length === 0;

    sendSuccess(
      res,
      { user: sanitizeUser(user), token, isNewUser },
      isNewUser ? 'Akun berhasil dibuat via Google.' : 'Login Google berhasil.'
    );
  } catch (err) {
    sendError(res, 'Terjadi kesalahan saat login Google.', 500, String(err));
  }
};


