"use strict";
// ============================================================
//  src/middlewares/validatorMiddleware.ts
//  Middleware Validasi — Fail Fast sebelum masuk ke controller
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiAnalysisValidationRules = exports.loginValidationRules = exports.registerValidationRules = exports.validateBody = void 0;
const response_js_1 = require("../utils/response.js");
/**
 * Validator email sederhana
 */
const isValidEmail = (email) => {
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
const validateBody = (rules) => {
    return (req, res, next) => {
        const errors = {};
        const body = req.body;
        for (const rule of rules) {
            const fieldErrors = [];
            const value = body[rule.field];
            const isEmpty = value === undefined || value === null || value === '';
            // Required check
            if (rule.required && isEmpty) {
                fieldErrors.push(`Field '${rule.field}' wajib diisi.`);
                errors[rule.field] = fieldErrors;
                continue; // skip type checks jika field kosong
            }
            if (isEmpty)
                continue; // field opsional dan tidak diisi, skip
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
                    fieldErrors.push(`Field '${rule.field}' minimal ${rule.minLength} karakter.`);
                }
                if (rule.maxLength !== undefined && value.length > rule.maxLength) {
                    fieldErrors.push(`Field '${rule.field}' maksimal ${rule.maxLength} karakter.`);
                }
                if (rule.pattern && !rule.pattern.test(value)) {
                    fieldErrors.push(rule.patternMessage ?? `Field '${rule.field}' format tidak valid.`);
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
            (0, response_js_1.sendBadRequest)(res, 'Validasi data gagal. Periksa kembali input Anda.', errors);
            return;
        }
        next();
    };
};
exports.validateBody = validateBody;
// -------------------------------------------------------
// Rule sets yang sudah dikonfigurasi untuk reuse
// -------------------------------------------------------
exports.registerValidationRules = [
    { field: 'name', required: true, type: 'string', minLength: 2, maxLength: 100 },
    { field: 'email', required: true, type: 'email' },
    {
        field: 'password',
        required: true,
        type: 'string',
        minLength: 8,
        maxLength: 72,
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        patternMessage: "Password harus mengandung minimal 1 huruf besar, 1 huruf kecil, dan 1 angka.",
    },
];
exports.loginValidationRules = [
    { field: 'email', required: true, type: 'email' },
    { field: 'password', required: true, type: 'string', minLength: 1 },
];
exports.aiAnalysisValidationRules = [
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
//# sourceMappingURL=validatorMiddleware.js.map