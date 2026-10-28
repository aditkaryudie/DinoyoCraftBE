// ============================================================
//  src/middlewares/authMiddleware.ts
//  Middleware Autentikasi — memverifikasi JWT dari header
// ============================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, UserRole } from '../types/index.js';
import { sendUnauthorized, sendForbidden } from '../utils/response.js';

const JWT_SECRET = process.env['JWT_SECRET'];
if (!JWT_SECRET) {
  throw new Error('❌ JWT_SECRET tidak ditemukan di environment variables!');
}

/**
 * verifyToken
 * Mengekstrak Bearer token dari header Authorization,
 * memverifikasi signature, lalu menyimpan payload ke res.locals.
 */
export const verifyToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let token: string | undefined;
  const authHeader = req.headers['authorization'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';');
    for (const cookie of cookies) {
      const parts = cookie.trim().split('=');
      const name = parts[0];
      const val = parts.slice(1).join('=');
      if (name === 'token' || name === 'jwt' || name === 'accessToken') {
        token = decodeURIComponent(val);
        break;
      }
    }
  }

  if (!token) {
    sendUnauthorized(res, 'Token autentikasi tidak ditemukan atau format salah.');
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Simpan payload ke res.locals dengan type assertion yang aman
    res.locals['userId'] = decoded.userId;
    res.locals['email'] = decoded.email;
    res.locals['role'] = decoded.role;
    req.user = { id: decoded.userId, ...decoded };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      sendUnauthorized(res, 'Token sudah kedaluwarsa. Silakan login ulang.');
    } else if (err instanceof jwt.JsonWebTokenError) {
      sendUnauthorized(res, 'Token tidak valid.');
    } else {
      sendUnauthorized(res, 'Gagal memverifikasi token.');
    }
  }
};

/**
 * requireRole
 * Middleware untuk membatasi akses berdasarkan peran (RBAC).
 * Harus digunakan SETELAH verifyToken.
 */
export const requireRole = (allowedRoles: UserRole[]) => {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const role = res.locals['role'] as UserRole | undefined;

    if (!role) {
      sendUnauthorized(res, 'Data autentikasi tidak lengkap. Token tidak valid.');
      return;
    }

    if (!allowedRoles.includes(role)) {
      sendForbidden(
        res,
        `Akses ditolak. Hanya ${allowedRoles.join(', ')} yang diizinkan.`
      );
      return;
    }

    next();
  };
};

/**
 * isAdmin
 * Middleware khusus admin (shortcut untuk requireRole(['admin']))
 */
export const isAdmin = requireRole(['admin']);

/**
 * Helper untuk mengambil data auth dari res.locals secara type-safe
 */
export const getAuthLocals = (
  res: Response
): { userId: number; email: string; role: UserRole } => {
  return {
    userId: res.locals['userId'] as number,
    email: res.locals['email'] as string,
    role: res.locals['role'] as UserRole,
  };
};
