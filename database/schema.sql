-- ============================================================
--  DinoyoCraft Database Schema
--  DDL MySQL — 5 Tabel Wajib
--  Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- ============================================================

CREATE DATABASE IF NOT EXISTS dinoyocraft_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE dinoyocraft_db;

-- ============================================================
-- TABEL 1: PENGGUNA & PERAN (users)
-- Menyimpan akun dan peran setiap pengguna sistem
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name            VARCHAR(100)    NOT NULL,
  email           VARCHAR(255)    NOT NULL,
  password_hash   VARCHAR(255)    NOT NULL COMMENT 'bcrypt hash, JANGAN tampilkan ke client',
  role            ENUM('admin', 'mitra', 'pengunjung') NOT NULL DEFAULT 'mitra',
  is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
  token_version   INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT 'Increment untuk invalidasi refresh token',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  INDEX idx_users_role (role),
  INDEX idx_users_is_active (is_active)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Tabel pengguna dengan sistem peran (RBAC)';

-- ============================================================
-- TABEL 2: DATA MASTER (master_data)
-- Menyimpan konfigurasi dan referensi bisnis yang bisa diubah
-- tanpa perlu deploy ulang (kategori produk, harga dasar, dll.)
-- ============================================================

CREATE TABLE IF NOT EXISTS master_data (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  category      VARCHAR(50)     NOT NULL COMMENT 'Kelompok data, contoh: KATEGORI_PRODUK, STATUS_TRANSAKSI',
  `key`         VARCHAR(100)    NOT NULL COMMENT 'Kunci unik dalam kategori',
  value         TEXT            NOT NULL COMMENT 'Nilai konfigurasi',
  description   VARCHAR(255)        NULL COMMENT 'Penjelasan penggunaan data',
  created_by    INT UNSIGNED    NOT NULL COMMENT 'ID admin yang membuat',
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_master_data_category_key (category, `key`),
  INDEX idx_master_data_category (category),
  FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Data master / referensi konfigurasi bisnis';

-- ============================================================
-- TABEL 3: TRANSAKSI / LOG PESANAN (transactions)
-- Mencatat setiap transaksi pembelian atau pesanan
-- ============================================================

CREATE TABLE IF NOT EXISTS transactions (
  id                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  user_id           INT UNSIGNED    NOT NULL COMMENT 'Mitra atau pembeli',
  transaction_type  VARCHAR(50)     NOT NULL COMMENT 'Contoh: PEMBELIAN, KONSINYASI, EKSPOR',
  amount            DECIMAL(15, 2)  NOT NULL DEFAULT 0.00,
  status            ENUM('pending', 'success', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  reference_code    VARCHAR(50)     NOT NULL COMMENT 'Kode unik transaksi (misal: TRX-20261010-001)',
  notes             TEXT                NULL,
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_transactions_reference_code (reference_code),
  INDEX idx_transactions_user_id (user_id),
  INDEX idx_transactions_status (status),
  INDEX idx_transactions_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Log transaksi dan pesanan';

-- ============================================================
-- TABEL 4: HASIL ANALISIS AI (ai_analysis_results)
-- Menyimpan histori permintaan dan hasil analisis dari Gemini
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_analysis_results (
  id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  user_id             INT UNSIGNED    NOT NULL,
  prompt_context      TEXT            NOT NULL COMMENT 'Konteks input yang sudah dianonimisasi (JSON string)',
  ai_response         JSON            NOT NULL COMMENT 'Hasil analisis Gemini dalam format JSON terstruktur',
  model_used          VARCHAR(100)    NOT NULL COMMENT 'Nama model Gemini yang digunakan',
  tokens_used         INT UNSIGNED        NULL COMMENT 'Estimasi token yang dikonsumsi',
  processing_time_ms  INT UNSIGNED        NULL COMMENT 'Waktu proses dalam milidetik',
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_ai_results_user_id (user_id),
  INDEX idx_ai_results_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Histori dan hasil analisis AI Gemini';

-- ============================================================
-- TABEL 5: LOG AUDIT (audit_logs)
-- Mencatat semua aktivitas sistem untuk keamanan dan debugging
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED        NULL COMMENT 'NULL jika aksi dilakukan oleh tamu',
  action      VARCHAR(255)    NOT NULL COMMENT 'Deskripsi aksi, contoh: [admin] POST /api/admin/users',
  table_name  VARCHAR(100)        NULL COMMENT 'Nama tabel yang dipengaruhi (opsional)',
  record_id   INT UNSIGNED        NULL COMMENT 'ID record yang dipengaruhi (opsional)',
  old_values  JSON                NULL COMMENT 'Nilai sebelum perubahan',
  new_values  JSON                NULL COMMENT 'Nilai setelah perubahan',
  ip_address  VARCHAR(45)         NULL COMMENT 'Mendukung IPv6 (maks 45 karakter)',
  user_agent  VARCHAR(500)        NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_audit_logs_user_id (user_id),
  INDEX idx_audit_logs_action (action(100)),
  INDEX idx_audit_logs_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Log audit semua aktivitas sistem';

-- ============================================================
-- SEED DATA: Admin default (ubah password setelah deploy!)
-- Password default: Admin123
-- Hash bcrypt (rounds=12): $2b$12$...
-- ============================================================

INSERT IGNORE INTO users (name, email, password_hash, role, is_active)
VALUES (
  'Super Admin',
  'csdinoyocraft@gmail.com',
  '$2b$10$wfcDxLuZWPYzSA5UeXj6HO2XU1xjLfaYD.fcGmH7I6fCsg8CZec2K',
  'admin',
  TRUE
);

-- ============================================================
-- SEED DATA: Master Data kategori produk keramik
-- ============================================================

INSERT IGNORE INTO master_data (category, `key`, value, description, created_by)
SELECT 
  'KATEGORI_PRODUK', 'GERABAH_TRADISIONAL', 
  'Gerabah Tradisional', 'Produk gerabah bermotif tradisional Jawa',
  u.id
FROM users u WHERE u.email = 'csdinoyocraft@gmail.com' LIMIT 1;

INSERT IGNORE INTO master_data (category, `key`, value, description, created_by)
SELECT 
  'KATEGORI_PRODUK', 'KERAMIK_MODERN', 
  'Keramik Modern', 'Produk keramik dengan desain kontemporer',
  u.id
FROM users u WHERE u.email = 'csdinoyocraft@gmail.com' LIMIT 1;

INSERT IGNORE INTO master_data (category, `key`, value, description, created_by)
SELECT 
  'KATEGORI_PRODUK', 'SOUVENIR_WISATA', 
  'Souvenir Wisata', 'Produk souvenir untuk pariwisata Malang',
  u.id
FROM users u WHERE u.email = 'csdinoyocraft@gmail.com' LIMIT 1;

INSERT IGNORE INTO master_data (category, `key`, value, description, created_by)
SELECT 
  'STATUS_TRANSAKSI', 'PENDING', 
  'Menunggu Konfirmasi', 'Transaksi sedang menunggu verifikasi',
  u.id
FROM users u WHERE u.email = 'csdinoyocraft@gmail.com' LIMIT 1;
