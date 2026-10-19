"use strict";
// ============================================================
//  src/utils/response.ts
//  Helper untuk standarisasi format response API
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendBadRequest = exports.sendNotFound = exports.sendForbidden = exports.sendUnauthorized = exports.sendCreated = exports.sendError = exports.sendSuccess = void 0;
const sendSuccess = (res, data, message = 'Request berhasil.', statusCode = 200, meta) => {
    const payload = { success: true, message, data };
    if (meta)
        payload.meta = meta;
    return res.status(statusCode).json(payload);
};
exports.sendSuccess = sendSuccess;
const sendError = (res, message, statusCode = 500, error) => {
    const payload = { success: false, message, error };
    return res.status(statusCode).json(payload);
};
exports.sendError = sendError;
const sendCreated = (res, data, message = 'Data berhasil dibuat.') => (0, exports.sendSuccess)(res, data, message, 201);
exports.sendCreated = sendCreated;
const sendUnauthorized = (res, message = 'Akses tidak diizinkan. Token tidak valid atau kedaluwarsa.') => (0, exports.sendError)(res, message, 401);
exports.sendUnauthorized = sendUnauthorized;
const sendForbidden = (res, message = 'Anda tidak memiliki izin untuk melakukan aksi ini.') => (0, exports.sendError)(res, message, 403);
exports.sendForbidden = sendForbidden;
const sendNotFound = (res, message = 'Data tidak ditemukan.') => (0, exports.sendError)(res, message, 404);
exports.sendNotFound = sendNotFound;
const sendBadRequest = (res, message = 'Data yang dikirim tidak valid.', error) => (0, exports.sendError)(res, message, 400, error);
exports.sendBadRequest = sendBadRequest;
//# sourceMappingURL=response.js.map