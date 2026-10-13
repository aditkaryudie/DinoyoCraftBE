-- ============================================================
--  Migration: Tabel untuk Mitra Registration
--  Menambah tabel shops dan registration_documents
-- ============================================================

USE dinoyocraft_db;

-- ============================================================
-- TABEL: SHOPS (Data Toko Mitra)
-- ============================================================

CREATE TABLE IF NOT EXISTS shops (
  id                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  user_id           INT UNSIGNED    NOT NULL COMMENT 'Foreign key ke users.id',
  shop_name         VARCHAR(255)    NOT NULL COMMENT 'Nama toko/workshop',
  address           TEXT            NOT NULL COMMENT 'Alamat lengkap workshop',
  city              VARCHAR(100)        NULL COMMENT 'Kota/Kabupaten',
  phone             VARCHAR(20)         NULL COMMENT 'Nomor telepon toko',
  year_started      INT             NOT NULL COMMENT 'Tahun mulai usaha (contoh: 2018)',
  description       TEXT                NULL COMMENT 'Deskripsi toko dan produk',
  website           VARCHAR(255)        NULL COMMENT 'Website toko',
  instagram         VARCHAR(100)        NULL COMMENT 'Handle Instagram (@username)',
  category          VARCHAR(100)        NULL COMMENT 'Kategori utama produk',
  banner_image_url  VARCHAR(500)        NULL COMMENT 'URL gambar banner toko',
  logo_image_url    VARCHAR(500)        NULL COMMENT 'URL gambar logo/avatar toko',
  is_verified       BOOLEAN         NOT NULL DEFAULT FALSE COMMENT 'Status verifikasi toko oleh admin',
  verification_date DATETIME            NULL COMMENT 'Tanggal verifikasi',
  verified_by       INT UNSIGNED        NULL COMMENT 'ID admin yang melakukan verifikasi',
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_shops_user_id (user_id),
  INDEX idx_shops_is_verified (is_verified),
  INDEX idx_shops_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Data toko dan workshop mitra';

-- ============================================================
-- TABEL: REGISTRATION_DOCUMENTS (Dokumen Pendaftaran Mitra)
-- ============================================================

CREATE TABLE IF NOT EXISTS registration_documents (
  id                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  user_id           INT UNSIGNED    NOT NULL COMMENT 'Foreign key ke users.id',
  document_type     ENUM('ktp', 'nib', 'product_photo') NOT NULL COMMENT 'Tipe dokumen yang diunggah',
  file_name         VARCHAR(255)    NOT NULL COMMENT 'Nama file asli',
  file_path         VARCHAR(500)    NOT NULL COMMENT 'Path file di storage (relative atau full URL)',
  file_size         INT UNSIGNED        NULL COMMENT 'Ukuran file dalam bytes',
  mime_type         VARCHAR(50)         NULL COMMENT 'MIME type file (image/jpeg, etc)',
  upload_date       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_approved       BOOLEAN         NOT NULL DEFAULT FALSE COMMENT 'Dokumen sudah diperiksa/disetujui admin',
  approval_notes    TEXT                NULL COMMENT 'Catatan admin untuk dokumen',
  approved_by       INT UNSIGNED        NULL COMMENT 'ID admin yang melakukan approval',
  approval_date     DATETIME            NULL COMMENT 'Tanggal approval',
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_reg_docs_user_id (user_id),
  INDEX idx_reg_docs_document_type (document_type),
  INDEX idx_reg_docs_is_approved (is_approved),
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Dokumen pendaftaran mitra (KTP, NIB, foto produk)';

-- ============================================================
-- Index tambahan untuk performa query
-- ============================================================

ALTER TABLE shops ADD INDEX idx_shops_verified_by (verified_by);
ALTER TABLE registration_documents ADD INDEX idx_reg_docs_approved_by (approved_by);
ALTER TABLE registration_documents ADD INDEX idx_reg_docs_created_at (created_at);
