// ============================================================
//  src/utils/response.ts
//  Helper untuk standarisasi format response API
// ============================================================

import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '../types/index.js';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'Request berhasil.',
  statusCode = 200,
  meta?: PaginationMeta
): Response => {
  const payload: ApiResponse<T> = { success: true, message, data };
  if (meta) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  error?: string | Record<string, string[]>
): Response => {
  const payload: ApiResponse = { success: false, message, error };
  return res.status(statusCode).json(payload);
};

export const sendCreated = <T>(
  res: Response,
  data: T,
  message = 'Data berhasil dibuat.'
): Response => sendSuccess(res, data, message, 201);

export const sendUnauthorized = (
  res: Response,
  message = 'Akses tidak diizinkan. Token tidak valid atau kedaluwarsa.'
): Response => sendError(res, message, 401);

export const sendForbidden = (
  res: Response,
  message = 'Anda tidak memiliki izin untuk melakukan aksi ini.'
): Response => sendError(res, message, 403);

export const sendNotFound = (
  res: Response,
  message = 'Data tidak ditemukan.'
): Response => sendError(res, message, 404);

export const sendBadRequest = (
  res: Response,
  message = 'Data yang dikirim tidak valid.',
  error?: Record<string, string[]>
): Response => sendError(res, message, 400, error);
