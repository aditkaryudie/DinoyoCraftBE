// ============================================================
//  src/config/database.ts
//  Konfigurasi koneksi MySQL dengan connection pool & Sequelize
// ============================================================

import mysql from 'mysql2/promise';
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const dbHost = process.env['DB_HOST'] ?? 'localhost';
const dbPort = Number(process.env['DB_PORT'] ?? 3306);
const dbUser = process.env['DB_USERNAME'] ?? 'root';
const dbPassword = process.env['DB_PASSWORD'] ?? '';
const dbName = process.env['DB_DATABASE'] ?? 'dinoyocraft_db';

export const pool = mysql.createPool({
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

export const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort,
  dialect: 'mysql',
  logging: false,
  timezone: '+07:00',
});

export const testConnection = async (): Promise<void> => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL connection established successfully.');
    conn.release();
    await sequelize.authenticate();
    console.log('✅ Sequelize connection established successfully.');
  } catch (error) {
    console.error('❌ MySQL connection failed:', error);
    process.exit(1);
  }
};

// Unified database proxy satisfying both mysql2 pool and Sequelize ORM
const db: any = new Proxy(sequelize, {
  get(target: any, prop: string | symbol, receiver: any) {
    if (prop === 'execute' || prop === 'getConnection' || prop === 'release' || prop === 'end') {
      const val = (pool as any)[prop];
      return typeof val === 'function' ? val.bind(pool) : val;
    }
    if (prop === 'query') {
      return function (...args: any[]) {
        if (
          args.length > 1 &&
          args[1] &&
          typeof args[1] === 'object' &&
          !Array.isArray(args[1]) &&
          ('type' in args[1] || 'model' in args[1] || 'raw' in args[1] || 'logging' in args[1] || 'instance' in args[1])
        ) {
          return (sequelize.query as any).apply(sequelize, args);
        }
        return (pool.query as any).apply(pool, args);
      };
    }
    if (prop in pool && !(prop in target)) {
      const val = (pool as any)[prop];
      return typeof val === 'function' ? val.bind(pool) : val;
    }
    const val = Reflect.get(target, prop, receiver);
    return typeof val === 'function' ? val.bind(target) : val;
  }
});

export default db as unknown as mysql.Pool & Sequelize;
