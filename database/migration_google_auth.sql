-- ============================================================
--  Migration: Google OAuth Support
--  Tambah kolom google_id dan avatar_url ke tabel users
--  Jalankan sekali saja terhadap database yang sudah ada
-- ============================================================

USE dinoyocraft_db;

-- Tambah kolom google_id (nullable — user tanpa Google tetap valid)
ALTER TABLE users
  ADD COLUMN google_id  VARCHAR(255) NULL COMMENT 'Google Subject ID dari OAuth 2.0'
    AFTER token_version,
  ADD COLUMN avatar_url VARCHAR(500) NULL COMMENT 'URL foto profil dari Google'
    AFTER google_id;

-- Buat unique index agar tidak ada duplikat google_id
-- (NULL diperbolehkan lebih dari satu dalam UNIQUE INDEX MySQL)
ALTER TABLE users
  ADD UNIQUE KEY uq_users_google_id (google_id);

-- password_hash boleh kosong/NULL untuk akun yang daftar via Google
-- Ubah kolom password_hash menjadi nullable
ALTER TABLE users
  MODIFY COLUMN password_hash VARCHAR(255) NULL
    COMMENT 'bcrypt hash, NULL untuk akun OAuth Google';
