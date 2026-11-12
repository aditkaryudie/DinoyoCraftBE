"use strict";
// ============================================================
//  src/middlewares/auditMiddleware.ts
//  Middleware Audit Log — mencatat setiap request ke database
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogger = exports.requestIdMiddleware = void 0;
const database_js_1 = __importDefault(require("../config/database.js"));
const loggingService_js_1 = require("../services/loggingService.js");
/**
 * requestIdMiddleware (§10.1)
 * Membaca X-Request-ID atau membuat ID korelasi baru dan menyertakannya pada header respons.
 */
const requestIdMiddleware = (req, res, next) => {
    const incomingId = req.headers['x-request-id']?.trim() ||
        req.headers['x-correlation-id']?.trim();
    const requestId = incomingId && incomingId.length <= 64 ? incomingId : (0, loggingService_js_1.generateRequestId)();
    res.locals['requestId'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
};
exports.requestIdMiddleware = requestIdMiddleware;
/**
 * auditLogger
 * Mencatat request ke tabel audit_logs (kompatibilitas legacy) dan system_logs (observability terstruktur)
 * setelah response dikirim tanpa memblokir request (menggunakan 'finish' event).
 */
const auditLogger = (req, res, next) => {
    const startHrTime = process.hrtime.bigint();
    res.on('finish', () => {
        const durationNs = Number(process.hrtime.bigint() - startHrTime);
        const durationMs = Math.max(1, Math.round(durationNs / 1_000_000));
        // 1. Catat ke system_logs terstruktur & broadcast Pusher (§10.1, §17)
        (0, loggingService_js_1.logHttpRequest)(req, res, durationMs);
        // 2. Pertahankan pencatatan ke audit_logs legacy (§9.2, §17)
        const userId = res.locals['userId'];
        const role = res.locals['role'];
        const action = `${req.method} ${req.route?.path ?? req.path}`;
        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
            req.socket.remoteAddress ??
            'unknown';
        const userAgent = req.headers['user-agent'] ?? 'unknown';
        if (req.path === '/health' || req.path === '/api/health')
            return;
        if (req.method === 'GET' && req.originalUrl?.startsWith('/api/admin/logs'))
            return;
        database_js_1.default
            .execute(`INSERT INTO audit_logs (user_id, action, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, NOW())`, [userId ?? null, `[${role ?? 'guest'}] ${action}`, ipAddress, userAgent])
            .catch((err) => {
            console.error('⚠️ Audit log gagal disimpan:', err);
        });
    });
    next();
};
exports.auditLogger = auditLogger;
//# sourceMappingURL=auditMiddleware.js.map