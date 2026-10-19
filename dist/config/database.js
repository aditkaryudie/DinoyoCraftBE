"use strict";
// ============================================================
//  src/config/database.ts
//  Konfigurasi koneksi MySQL dengan connection pool
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testConnection = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pool = promise_1.default.createPool({
    host: process.env['DB_HOST'] ?? 'localhost',
    port: Number(process.env['DB_PORT'] ?? 3306),
    user: process.env['DB_USERNAME'] ?? 'root',
    password: process.env['DB_PASSWORD'] ?? '',
    database: process.env['DB_DATABASE'] ?? 'dinoyocraft_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: 'utf8mb4',
    timezone: '+07:00',
});
const testConnection = async () => {
    try {
        const conn = await pool.getConnection();
        console.log('✅ MySQL connection established successfully.');
        conn.release();
    }
    catch (error) {
        console.error('❌ MySQL connection failed:', error);
        process.exit(1);
    }
};
exports.testConnection = testConnection;
exports.default = pool;
//# sourceMappingURL=database.js.map