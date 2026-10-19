"use strict";
// ============================================================
//  src/middlewares/auditMiddleware.ts
//  Middleware Audit Log — mencatat setiap request ke database
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogger = void 0;
const database_js_1 = __importDefault(require("../config/database.js"));
/**
 * auditLogger
 * Mencatat request ke tabel audit_logs setelah response dikirim.
 * Tidak memblokir request (menggunakan 'finish' event).
 */
const auditLogger = (req, res, next) => {
    res.on('finish', () => {
        const userId = res.locals['userId'];
        const role = res.locals['role'];
        const action = `${req.method} ${req.route?.path ?? req.path}`;
        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
            req.socket.remoteAddress ??
            'unknown';
        const userAgent = req.headers['user-agent'] ?? 'unknown';
        // Jangan log request health check
        if (req.path === '/health')
            return;
        database_js_1.default
            .execute(`INSERT INTO audit_logs (user_id, action, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, NOW())`, [userId ?? null, `[${role ?? 'guest'}] ${action}`, ipAddress, userAgent])
            .catch((err) => {
            // Jangan crash aplikasi karena gagal audit log
            console.error('⚠️ Audit log gagal disimpan:', err);
        });
    });
    next();
};
exports.auditLogger = auditLogger;
//# sourceMappingURL=auditMiddleware.js.map