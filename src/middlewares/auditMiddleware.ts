// ============================================================
//  src/middlewares/auditMiddleware.ts
//  Middleware Audit Log — mencatat setiap request ke database
// ============================================================

import { Request, Response, NextFunction } from 'express';
import pool from '../config/database.js';
import { UserRole } from '../types/index.js';

/**
 * auditLogger
 * Mencatat request ke tabel audit_logs setelah response dikirim.
 * Tidak memblokir request (menggunakan 'finish' event).
 */
export const auditLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.on('finish', () => {
    const userId = res.locals['userId'] as number | undefined;
    const role = res.locals['role'] as UserRole | undefined;
    const action = `${req.method} ${req.route?.path ?? req.path}`;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      'unknown';
    const userAgent = req.headers['user-agent'] ?? 'unknown';

    // Jangan log request health check
    if (req.path === '/health') return;

    pool
      .execute(
        `INSERT INTO audit_logs (user_id, action, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [userId ?? null, `[${role ?? 'guest'}] ${action}`, ipAddress, userAgent]
      )
      .catch((err: unknown) => {
        // Jangan crash aplikasi karena gagal audit log
        console.error('⚠️ Audit log gagal disimpan:', err);
      });
  });

  next();
};
