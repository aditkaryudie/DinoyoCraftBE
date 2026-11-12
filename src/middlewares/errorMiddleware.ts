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
  res.locals['logCategory'] = 'system';
  res.locals['logEventName'] = 'system.route.not_found';
  res.locals['logMessage'] = `Route tidak ditemukan (404): ${req.method} ${req.originalUrl.split('?')[0]}`;
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
  res.locals['loggedError'] = err;
  res.locals['logEventName'] = 'system.unhandled_error';

  const isDev = process.env['NODE_ENV'] === 'development';

  sendError(
    res,
    isDev ? err.message : 'Terjadi kesalahan internal pada server.',
    500,
    isDev ? err.stack : undefined
  );
};
