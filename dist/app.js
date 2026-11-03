"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiLimiter = void 0;
require("dotenv/config");
// ============================================================
//  src/app.ts
//  Konfigurasi Express Application & Global Middleware
// ============================================================
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const index_js_1 = __importDefault(require("./routes/index.js"));
const errorMiddleware_js_1 = require("./middlewares/errorMiddleware.js");
const auditMiddleware_js_1 = require("./middlewares/auditMiddleware.js");
const path_1 = __importDefault(require("path"));
// Load environment variables SEBELUM apapun
dotenv_1.default.config();
const app = (0, express_1.default)();
// -------------------------------------------------------
// 1. CORS — Konfigurasi origin ramah Mobile & Web
// -------------------------------------------------------
app.use((0, cors_1.default)({
    origin: (_origin, callback) => {
        // Izinkan request tanpa origin (seperti aplikasi native Flutter, Postman, emulator)
        // serta origin browser web frontend
        callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));
// 2. Keamanan — Helmet & Rate Limiter
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
}));
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit.',
    },
});
app.use('/api', exports.apiLimiter);
// -------------------------------------------------------
// 3. Body Parsing
// -------------------------------------------------------
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// -------------------------------------------------------
// 4. Keamanan — Header dasar
// -------------------------------------------------------
app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.removeHeader('X-Powered-By');
    next();
});
// -------------------------------------------------------
// 5. Audit Logger (non-blocking)
// -------------------------------------------------------
app.use(auditMiddleware_js_1.auditLogger);
// -------------------------------------------------------
// 6. Health Check — sebelum router utama
// -------------------------------------------------------
app.get(['/health', '/api/health'], (_req, res) => {
    res.status(200).json({
        success: true,
        message: 'DinoyoCraft API is running 🚀',
        timestamp: new Date().toISOString(),
        environment: process.env['NODE_ENV'] ?? 'development',
    });
});
// Kunci target folder baca agar PERSIS SAMA dengan Multer
const targetFolder = path_1.default.join(process.cwd(), 'uploads');
console.log('📂 Static Server membaca dari:', targetFolder);
app.use('/uploads', express_1.default.static(targetFolder));
// -------------------------------------------------------
// 7. Router Utama
// -------------------------------------------------------
app.use('/api', index_js_1.default);
// -------------------------------------------------------
// 8. 404 Handler — route tidak ditemukan
// -------------------------------------------------------
app.use(errorMiddleware_js_1.notFound);
// -------------------------------------------------------
// 9. Global Error Handler — HARUS paling terakhir
// -------------------------------------------------------
app.use(errorMiddleware_js_1.globalErrorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map