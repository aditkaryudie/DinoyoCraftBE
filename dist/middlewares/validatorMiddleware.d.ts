import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
/**
 * validateZod
 * Middleware validasi berbasis Zod Schema
 */
export declare const validateZod: (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => void;
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
export declare const validateBody: (rules: ValidationRule[]) => (req: Request, res: Response, next: NextFunction) => void;
export declare const registerValidationRules: ValidationRule[];
export declare const loginValidationRules: ValidationRule[];
export declare const aiAnalysisValidationRules: ValidationRule[];
export {};
//# sourceMappingURL=validatorMiddleware.d.ts.map