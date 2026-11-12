// ============================================================
//  src/middlewares/auditMiddleware.ts
//  Middleware Audit Log — mencatat setiap request ke database
// ============================================================

import { Request, Response, NextFunction } from 'express';
import pool from '../config/database.js';
import { UserRole } from '../types/index.js';
import { generateRequestId, logHttpRequest } from '../services/loggingService.js';

/**
 * requestIdMiddleware (§10.1)
 * Membaca X-Request-ID atau membuat ID korelasi baru dan menyertakannya pada header respons.
 */
export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const incomingId =
    (req.headers['x-request-id'] as string)?.trim() ||
    (req.headers['x-correlation-id'] as string)?.trim();
  const requestId = incomingId && incomingId.length <= 64 ? incomingId : generateRequestId();

  res.locals['requestId'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

/**
 * auditLogger
 * Mencatat request ke tabel audit_logs (kompatibilitas legacy) dan system_logs (observability terstruktur)
 * setelah response dikirim tanpa memblokir request (menggunakan 'finish' event).
 */
export const auditLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startHrTime = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - startHrTime);
    const durationMs = Math.max(1, Math.round(durationNs / 1_000_000));

    // 1. Catat ke system_logs terstruktur & broadcast Pusher (§10.1, §17)
    logHttpRequest(req, res, durationMs);

    // 2. Pertahankan pencatatan ke audit_logs legacy (§9.2, §17)
    const userId = res.locals['userId'] as number | undefined;
    const role = res.locals['role'] as UserRole | undefined;
    const action = `${req.method} ${req.route?.path ?? req.path}`;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      'unknown';
    const userAgent = req.headers['user-agent'] ?? 'unknown';

    if (req.path === '/health' || req.path === '/api/health') return;
    if (req.method === 'GET' && req.originalUrl?.startsWith('/api/admin/logs')) return;

    pool
      .execute(
        `INSERT INTO audit_logs (user_id, action, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [userId ?? null, `[${role ?? 'guest'}] ${action}`, ipAddress, userAgent]
      )
      .catch((err: unknown) => {
        console.error('⚠️ Audit log gagal disimpan:', err);
      });
  });

  next();
};
