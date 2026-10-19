"use strict";
// ============================================================
//  src/middlewares/errorMiddleware.ts
//  Global Error Handler — menangkap semua error tak terduga
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandler = exports.notFound = void 0;
const response_js_1 = require("../utils/response.js");
/**
 * notFound
 * Handler untuk route yang tidak ditemukan (404)
 */
const notFound = (req, res) => {
    (0, response_js_1.sendError)(res, `Route tidak ditemukan: ${req.method} ${req.originalUrl}`, 404);
};
exports.notFound = notFound;
/**
 * globalErrorHandler
 * Harus menjadi middleware TERAKHIR yang didaftarkan di app.ts
 */
const globalErrorHandler = (err, _req, res, _next) => {
    console.error('🔥 Unhandled Error:', err);
    const isDev = process.env['NODE_ENV'] === 'development';
    (0, response_js_1.sendError)(res, isDev ? err.message : 'Terjadi kesalahan internal pada server.', 500, isDev ? err.stack : undefined);
};
exports.globalErrorHandler = globalErrorHandler;
//# sourceMappingURL=errorMiddleware.js.map