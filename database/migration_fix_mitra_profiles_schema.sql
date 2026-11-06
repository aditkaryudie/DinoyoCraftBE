-- ============================================================
--  Migration: Fix Mitra Profiles Schema (Idempotent)
--  Menambahkan kolom description, website, instagram,
--  banner_url, avatar_url, dan rejection_reason pada tabel
--  mitra_profiles secara idempotent (aman dijalankan berulang
--  kali tanpa menghapus data atau membuat kolom duplikat).
-- ============================================================

USE dinoyocraft_db;

-- 1. description
SET @col_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'mitra_profiles'
    AND COLUMN_NAME = 'description'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `mitra_profiles` ADD COLUMN `description` TEXT NULL AFTER `started_year`',
  'SELECT "Column description already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. website
SET @col_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'mitra_profiles'
    AND COLUMN_NAME = 'website'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `mitra_profiles` ADD COLUMN `website` VARCHAR(255) DEFAULT NULL AFTER `description`',
  'SELECT "Column website already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. instagram
SET @col_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'mitra_profiles'
    AND COLUMN_NAME = 'instagram'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `mitra_profiles` ADD COLUMN `instagram` VARCHAR(100) DEFAULT NULL AFTER `website`',
  'SELECT "Column instagram already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. banner_url
SET @col_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'mitra_profiles'
    AND COLUMN_NAME = 'banner_url'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `mitra_profiles` ADD COLUMN `banner_url` VARCHAR(500) DEFAULT NULL AFTER `instagram`',
  'SELECT "Column banner_url already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. avatar_url
SET @col_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'mitra_profiles'
    AND COLUMN_NAME = 'avatar_url'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `mitra_profiles` ADD COLUMN `avatar_url` VARCHAR(500) DEFAULT NULL AFTER `banner_url`',
  'SELECT "Column avatar_url already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. rejection_reason
SET @col_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'mitra_profiles'
    AND COLUMN_NAME = 'rejection_reason'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `mitra_profiles` ADD COLUMN `rejection_reason` TEXT DEFAULT NULL AFTER `is_verified`',
  'SELECT "Column rejection_reason already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 7. Sinkronisasi avatar_url mitra_profiles yang masih NULL dari users.avatar_url
UPDATE `mitra_profiles` m
INNER JOIN `users` u ON m.user_id = u.id
SET m.avatar_url = u.avatar_url
WHERE m.avatar_url IS NULL AND u.avatar_url IS NOT NULL;

