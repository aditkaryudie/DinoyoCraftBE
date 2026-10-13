// ============================================================
//  src/config/database.ts
//  Konfigurasi koneksi MySQL dengan connection pool
// ============================================================

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
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

export const testConnection = async (): Promise<void> => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL connection established successfully.');
    conn.release();
  } catch (error) {
    console.error('❌ MySQL connection failed:', error);
    process.exit(1);
  }
};

export default pool;
