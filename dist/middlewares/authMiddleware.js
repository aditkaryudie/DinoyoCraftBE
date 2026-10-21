"use strict";
// ============================================================
//  src/middlewares/authMiddleware.ts
//  Middleware Autentikasi — memverifikasi JWT dari header
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthLocals = exports.requireRole = exports.verifyToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const response_js_1 = require("../utils/response.js");
const JWT_SECRET = process.env['JWT_SECRET'];
if (!JWT_SECRET) {
    throw new Error('❌ JWT_SECRET tidak ditemukan di environment variables!');
}
/**
 * verifyToken
 * Mengekstrak Bearer token dari header Authorization,
 * memverifikasi signature, lalu menyimpan payload ke res.locals.
 */
const verifyToken = (req, res, next) => {
    let token;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }
    else if (req.headers.cookie) {
        const cookies = req.headers.cookie.split(';');
        for (const cookie of cookies) {
            const parts = cookie.trim().split('=');
            const name = parts[0];
            const val = parts.slice(1).join('=');
            if (name === 'token' || name === 'jwt' || name === 'accessToken') {
                token = decodeURIComponent(val);
                break;
            }
        }
    }
    if (!token) {
        (0, response_js_1.sendUnauthorized)(res, 'Token autentikasi tidak ditemukan atau format salah.');
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Simpan payload ke res.locals dengan type assertion yang aman
        res.locals['userId'] = decoded.userId;
        res.locals['email'] = decoded.email;
        res.locals['role'] = decoded.role;
        req.user = { id: decoded.userId, ...decoded };
        next();
    }
    catch (err) {
        if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
            (0, response_js_1.sendUnauthorized)(res, 'Token sudah kedaluwarsa. Silakan login ulang.');
        }
        else if (err instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            (0, response_js_1.sendUnauthorized)(res, 'Token tidak valid.');
        }
        else {
            (0, response_js_1.sendUnauthorized)(res, 'Gagal memverifikasi token.');
        }
    }
};
exports.verifyToken = verifyToken;
/**
 * requireRole
 * Middleware untuk membatasi akses berdasarkan peran (RBAC).
 * Harus digunakan SETELAH verifyToken.
 */
const requireRole = (allowedRoles) => {
    return (_req, res, next) => {
        const role = res.locals['role'];
        if (!role) {
            (0, response_js_1.sendUnauthorized)(res, 'Data autentikasi tidak lengkap. Token tidak valid.');
            return;
        }
        if (!allowedRoles.includes(role)) {
            (0, response_js_1.sendForbidden)(res, `Akses ditolak. Hanya ${allowedRoles.join(', ')} yang diizinkan.`);
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
/**
 * Helper untuk mengambil data auth dari res.locals secara type-safe
 */
const getAuthLocals = (res) => {
    return {
        userId: res.locals['userId'],
        email: res.locals['email'],
        role: res.locals['role'],
    };
};
exports.getAuthLocals = getAuthLocals;
//# sourceMappingURL=authMiddleware.js.map