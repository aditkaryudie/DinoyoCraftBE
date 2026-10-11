// ============================================================
//  src/middlewares/errorMiddleware.ts
//  Global Error Handler — menangkap semua error tak terduga
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';

/**
 * notFound
 * Handler untuk route yang tidak ditemukan (404)
 */
export const notFound = (req: Request, res: Response): void => {
  sendError(
    res,
    `Route tidak ditemukan: ${req.method} ${req.originalUrl}`,
    404
  );
};

/**
 * globalErrorHandler
 * Harus menjadi middleware TERAKHIR yang didaftarkan di app.ts
 */
export const globalErrorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('🔥 Unhandled Error:', err);

  const isDev = process.env['NODE_ENV'] === 'development';

  sendError(
    res,
    isDev ? err.message : 'Terjadi kesalahan internal pada server.',
    500,
    isDev ? err.stack : undefined
  );
};
