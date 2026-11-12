// ============================================================
//  src/middlewares/validatorMiddleware.ts
//  Middleware Validasi — Fail Fast sebelum masuk ke controller
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { sendBadRequest } from '../utils/response.js';
import { ZodSchema } from 'zod';

/**
 * validateZod
 * Middleware validasi berbasis Zod Schema
 */
export const validateZod = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const field = issue.path.join('.') || 'body';
        if (!fieldErrors[field]) fieldErrors[field] = [];
        fieldErrors[field].push(issue.message);
      }
      sendBadRequest(res, 'Validasi data gagal. Periksa kembali input Anda.', fieldErrors);
      return;
    }
    req.body = result.data;
    next();
  };
};

type ValidationRule = {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'email' | 'array';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  patternMessage?: string;
};

type ValidationErrors = Record<string, string[]>;

/**
 * Validator email sederhana
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * validateBody
 * Memvalidasi req.body berdasarkan rules yang diberikan.
 * Jika ada field yang gagal validasi, langsung return 400 Bad Request.
 *
 * @param rules Array aturan validasi untuk setiap field
 *
 * @example
 * router.post('/login', validateBody([
 *   { field: 'email', required: true, type: 'email' },
 *   { field: 'password', required: true, type: 'string', minLength: 8 },
 * ]), authController.login)
 */
export const validateBody = (rules: ValidationRule[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: ValidationErrors = {};
    const body = req.body as Record<string, unknown>;

    for (const rule of rules) {
      const fieldErrors: string[] = [];
      const value = body[rule.field];
      const isEmpty =
        value === undefined || value === null || value === '';

      // Required check
      if (rule.required && isEmpty) {
        fieldErrors.push(`Field '${rule.field}' wajib diisi.`);
        errors[rule.field] = fieldErrors;
        continue; // skip type checks jika field kosong
      }

      if (isEmpty) continue; // field opsional dan tidak diisi, skip

      // Type check
      if (rule.type) {
        switch (rule.type) {
          case 'string':
            if (typeof value !== 'string') {
              fieldErrors.push(`Field '${rule.field}' harus berupa teks.`);
            }
            break;
          case 'number':
            if (typeof value !== 'number' || isNaN(value)) {
              fieldErrors.push(`Field '${rule.field}' harus berupa angka.`);
            }
            break;
          case 'boolean':
            if (typeof value !== 'boolean') {
              fieldErrors.push(`Field '${rule.field}' harus berupa boolean.`);
            }
            break;
          case 'email':
            if (typeof value !== 'string' || !isValidEmail(value)) {
              fieldErrors.push(`Field '${rule.field}' harus berupa email yang valid.`);
            }
            break;
          case 'array':
            if (!Array.isArray(value)) {
              fieldErrors.push(`Field '${rule.field}' harus berupa array.`);
            }
            break;
        }
      }

      // String length checks
      if (typeof value === 'string') {
        if (rule.minLength !== undefined && value.length < rule.minLength) {
          fieldErrors.push(
            `Field '${rule.field}' minimal ${rule.minLength} karakter.`
          );
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
          fieldErrors.push(
            `Field '${rule.field}' maksimal ${rule.maxLength} karakter.`
          );
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          fieldErrors.push(
            rule.patternMessage ?? `Field '${rule.field}' format tidak valid.`
          );
        }
      }

      // Number range checks
      if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          fieldErrors.push(`Field '${rule.field}' minimal ${rule.min}.`);
        }
        if (rule.max !== undefined && value > rule.max) {
          fieldErrors.push(`Field '${rule.field}' maksimal ${rule.max}.`);
        }
      }

      if (fieldErrors.length > 0) {
        errors[rule.field] = fieldErrors;
      }
    }

    if (Object.keys(errors).length > 0) {
      sendBadRequest(res, 'Validasi data gagal. Periksa kembali input Anda.', errors);
      return;
    }

    next();
  };
};

// -------------------------------------------------------
// Rule sets yang sudah dikonfigurasi untuk reuse
// -------------------------------------------------------

export const registerValidationRules: ValidationRule[] = [
  { field: 'name', required: true, type: 'string', minLength: 2, maxLength: 100 },
  { field: 'email', required: true, type: 'email' },
  {
    field: 'password',
    required: true,
    type: 'string',
    minLength: 8,
    maxLength: 72,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    patternMessage:
      "Password harus mengandung minimal 1 huruf besar, 1 huruf kecil, dan 1 angka.",
  },
];

export const loginValidationRules: ValidationRule[] = [
  { field: 'email', required: true, type: 'email' },
  { field: 'password', required: true, type: 'string', minLength: 1 },
];

export const aiAnalysisValidationRules: ValidationRule[] = [
  {
    field: 'context',
    required: true,
    type: 'string',
    minLength: 10,
    maxLength: 2000,
  },
  { field: 'productCategory', required: false, type: 'string', maxLength: 100 },
  { field: 'targetMarket', required: false, type: 'string', maxLength: 100 },
  { field: 'additionalNotes', required: false, type: 'string', maxLength: 500 },
];
