"use strict";
// ============================================================
//  src/config/database.ts
//  Konfigurasi koneksi MySQL dengan connection pool & Sequelize
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testConnection = exports.sequelize = exports.pool = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const sequelize_1 = require("sequelize");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const dbHost = process.env['DB_HOST'] ?? 'localhost';
const dbPort = Number(process.env['DB_PORT'] ?? 3306);
const dbUser = process.env['DB_USERNAME'] ?? 'root';
const dbPassword = process.env['DB_PASSWORD'] ?? '';
const dbName = process.env['DB_DATABASE'] ?? 'dinoyocraft_db';
exports.pool = promise_1.default.createPool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    multipleStatements: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: 'utf8mb4',
    timezone: '+07:00',
});
exports.sequelize = new sequelize_1.Sequelize(dbName, dbUser, dbPassword, {
    host: dbHost,
    port: dbPort,
    dialect: 'mysql',
    logging: false,
    timezone: '+07:00',
});
const testConnection = async () => {
    try {
        const conn = await exports.pool.getConnection();
        console.log('✅ MySQL connection established successfully.');
        conn.release();
        await exports.sequelize.authenticate();
        console.log('✅ Sequelize connection established successfully.');
    }
    catch (error) {
        console.error('❌ MySQL connection failed:', error);
        process.exit(1);
    }
};
exports.testConnection = testConnection;
// Unified database proxy satisfying both mysql2 pool and Sequelize ORM
const db = new Proxy(exports.sequelize, {
    get(target, prop, receiver) {
        if (prop === 'execute' || prop === 'getConnection' || prop === 'release' || prop === 'end') {
            const val = exports.pool[prop];
            return typeof val === 'function' ? val.bind(exports.pool) : val;
        }
        if (prop === 'query') {
            return function (...args) {
                if (args.length > 1 &&
                    args[1] &&
                    typeof args[1] === 'object' &&
                    !Array.isArray(args[1]) &&
                    ('type' in args[1] || 'model' in args[1] || 'raw' in args[1] || 'logging' in args[1] || 'instance' in args[1])) {
                    return exports.sequelize.query.apply(exports.sequelize, args);
                }
                return exports.pool.query.apply(exports.pool, args);
            };
        }
        if (prop in exports.pool && !(prop in target)) {
            const val = exports.pool[prop];
            return typeof val === 'function' ? val.bind(exports.pool) : val;
        }
        const val = Reflect.get(target, prop, receiver);
        return typeof val === 'function' ? val.bind(target) : val;
    }
});
exports.default = db;
//# sourceMappingURL=database.js.map