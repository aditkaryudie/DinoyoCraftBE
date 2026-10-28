-- ============================================================
--  DinoyoCraft — Master Database Schema & Seed Data
--  Platform E-Commerce & Kerajinan Keramik Dinoyo Malang
--  Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
--  File ini adalah master DDL & Seed data lengkap (Production Ready).
-- ============================================================

CREATE DATABASE IF NOT EXISTS `dinoyocraft_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `dinoyocraft_db`;

-- Matikan pengecekan Foreign Key sementara agar proses pembuatan tabel aman
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. TABEL PENGGUNA & AKUN (users)
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Hash bcrypt untuk autentikasi kata sandi',
  `role` enum('admin','mitra','pengunjung') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pengunjung',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Status akun aktif (1) atau dinonaktifkan (0)',
  `token_version` int UNSIGNED NOT NULL DEFAULT '0' COMMENT 'Invalidasi refresh token sesi',
  `google_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ID sub Google OAuth 2.0',
  `avatar_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_google_id` (`google_id`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. TABEL BUKU ALAMAT PENGGUNA (user_addresses)
-- ============================================================
CREATE TABLE IF NOT EXISTS `user_addresses` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int UNSIGNED NOT NULL,
  `recipient_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_address` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `postal_code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `label` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Rumah',
  `is_default` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_addresses_user` (`user_id`),
  CONSTRAINT `fk_addresses_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. TABEL VERIFIKASI OTP PERSISTEN (user_otps)
-- ============================================================
CREATE TABLE IF NOT EXISTS `user_otps` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int UNSIGNED NOT NULL,
  `otp_code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `otp_type` enum('register','reset_password','login') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reset_password',
  `expires_at` datetime NOT NULL,
  `is_used` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_otps_user` (`user_id`),
  KEY `idx_user_otps_lookup` (`user_id`, `otp_code`, `is_used`),
  CONSTRAINT `fk_otps_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. TABEL PROFIL TOKO PENGRAJIN (mitra_profiles)
-- ============================================================
CREATE TABLE IF NOT EXISTS `mitra_profiles` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int UNSIGNED NOT NULL,
  `whatsapp_number` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `store_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `workshop_address` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `started_year` year DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `website` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `instagram` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `banner_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ktp_file_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nib_file_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sample_product_images` json NOT NULL,
  `is_verified` tinyint(1) DEFAULT '0' COMMENT '0: Menunggu, 1: Disetujui, 2: Ditolak',
  `rejection_reason` text COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Catatan admin jika verifikasi ditolak',
  `is_active` tinyint(1) DEFAULT '1',
  `rating` decimal(3,2) DEFAULT '0.00',
  `total_reviews` int DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mitra_user_id` (`user_id`),
  CONSTRAINT `fk_mitra_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. TABEL KATEGORI PRODUK (categories)
-- ============================================================
CREATE TABLE IF NOT EXISTS `categories` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. TABEL KATALOG PRODUK KERAMIK (products)
-- ============================================================
CREATE TABLE IF NOT EXISTS `products` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `mitra_id` int UNSIGNED NOT NULL,
  `category_id` int UNSIGNED NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `price` decimal(15,2) NOT NULL,
  `stock` int NOT NULL DEFAULT '0',
  `weight_gram` int NOT NULL DEFAULT '500' COMMENT 'Estimasi berat produk untuk ongkos kirim',
  `variants` json DEFAULT NULL COMMENT 'Daftar varian produk (warna, ukuran, dsb)',
  `image_urls` json DEFAULT NULL COMMENT 'Array URL foto produk keramik',
  `rating` decimal(3,2) DEFAULT '0.00' COMMENT 'Cache rata-rata rating',
  `total_reviews` int DEFAULT '0' COMMENT 'Cache total ulasan pembeli',
  `is_deleted` tinyint(1) DEFAULT '0' COMMENT 'Soft delete flag',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_products_mitra` (`mitra_id`),
  KEY `idx_products_category` (`category_id`),
  KEY `idx_products_is_deleted` (`is_deleted`),
  CONSTRAINT `fk_products_mitra` FOREIGN KEY (`mitra_id`) REFERENCES `mitra_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. TABEL KERANJANG BELANJA (carts)
-- ============================================================
CREATE TABLE IF NOT EXISTS `carts` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int UNSIGNED NOT NULL,
  `product_id` int UNSIGNED NOT NULL,
  `variant` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_carts_user` (`user_id`),
  CONSTRAINT `fk_carts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_carts_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. TABEL TRANSAKSI PEMBAYARAN (transactions)
-- ============================================================
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int UNSIGNED NOT NULL,
  `transaction_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `status` enum('pending','success','failed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `reference_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `proof_image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_transactions_reference_code` (`reference_code`),
  KEY `idx_transactions_user` (`user_id`),
  CONSTRAINT `fk_transactions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. TABEL PESANAN CUSTOMER (orders)
-- ============================================================
CREATE TABLE IF NOT EXISTS `orders` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int UNSIGNED NOT NULL,
  `mitra_id` int UNSIGNED NOT NULL,
  `address_id` int UNSIGNED DEFAULT NULL,
  `transaction_id` int UNSIGNED DEFAULT NULL,
  `total_amount` decimal(15,2) NOT NULL,
  `shipping_cost` decimal(15,2) NOT NULL DEFAULT '0.00',
  `shipping_method` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Reguler',
  `tracking_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_notes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','paid','packed','shipped','completed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_orders_user` (`user_id`),
  KEY `idx_orders_mitra` (`mitra_id`),
  CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_orders_mitra` FOREIGN KEY (`mitra_id`) REFERENCES `mitra_profiles` (`id`),
  CONSTRAINT `fk_orders_address` FOREIGN KEY (`address_id`) REFERENCES `user_addresses` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_orders_transaction` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. TABEL RINCIAN ITEM PESANAN (order_items)
-- ============================================================
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` int UNSIGNED NOT NULL,
  `product_id` int UNSIGNED NOT NULL,
  `variant` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int NOT NULL,
  `unit_price` decimal(15,2) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order` (`order_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 11. TABEL ULASAN PRODUK & RATING (reviews)
-- ============================================================
CREATE TABLE IF NOT EXISTS `reviews` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_item_id` int UNSIGNED DEFAULT NULL,
  `product_id` int UNSIGNED NOT NULL,
  `user_id` int UNSIGNED NOT NULL,
  `rating` tinyint UNSIGNED NOT NULL DEFAULT '5',
  `variant` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `comment` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `photo_urls` json DEFAULT NULL,
  `helpful_count` int UNSIGNED DEFAULT '0',
  `seller_reply` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `replied_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reviews_product` (`product_id`),
  KEY `idx_reviews_user` (`user_id`),
  CONSTRAINT `fk_reviews_order_item` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 12. TABEL NOTIFIKASI PENGGUNA & TOKO (notifications)
-- ============================================================
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int UNSIGNED NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('order','mitra','promo','system') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system',
  `reference_id` int UNSIGNED DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user` (`user_id`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 13. TABEL PERCAKAPAN CHAT (messages) [Enkripsi AES-256]
-- ============================================================
CREATE TABLE IF NOT EXISTS `messages` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `sender_id` int UNSIGNED NOT NULL,
  `receiver_id` int UNSIGNED NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Ciphertext terenkripsi algoritma AES-256-CBC',
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_messages_sender` (`sender_id`),
  KEY `idx_messages_receiver` (`receiver_id`),
  CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_messages_receiver` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 14. TABEL LAPORAN PENGADUAN MODERASI (reports)
-- ============================================================
CREATE TABLE IF NOT EXISTS `reports` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `reporter_id` int UNSIGNED NOT NULL,
  `target_type` enum('product','mitra','review','user') COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_id` int UNSIGNED NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','investigating','resolved','dismissed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reports_reporter` (`reporter_id`),
  CONSTRAINT `fk_reports_reporter` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 15. TABEL PERMOHONAN HAPUS AKUN (account_deletions)
-- ============================================================
CREATE TABLE IF NOT EXISTS `account_deletions` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int UNSIGNED NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `requested_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_account_deletions_user` (`user_id`),
  CONSTRAINT `fk_account_deletions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 16. TABEL LOG AUDIT SISTEM (audit_logs)
-- ============================================================
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int UNSIGNED DEFAULT NULL,
  `action` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `table_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `record_id` int UNSIGNED DEFAULT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_logs_user` (`user_id`),
  CONSTRAINT `fk_audit_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 17. TABEL DATA MASTER PLATFORM (master_data)
-- ============================================================
CREATE TABLE IF NOT EXISTS `master_data` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `category` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` int UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_master_data_category_key` (`category`,`key`),
  KEY `idx_master_data_creator` (`created_by`),
  CONSTRAINT `fk_master_data_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 18. TABEL RIWAYAT ANALISIS AI GEMINI (ai_analysis_results)
-- ============================================================
CREATE TABLE IF NOT EXISTS `ai_analysis_results` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` int UNSIGNED NOT NULL,
  `prompt_context` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `ai_response` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `model_used` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokens_used` int UNSIGNED DEFAULT NULL,
  `processing_time_ms` int UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_analysis_user` (`user_id`),
  CONSTRAINT `fk_ai_analysis_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SEED DATA AWAL (INSERT IGNORE)
-- ============================================================

-- Akun Super Admin & Sampel Awal
INSERT IGNORE INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `is_active`, `token_version`, `google_id`, `avatar_url`, `created_at`, `updated_at`) VALUES
(1, 'Super Admin', 'csdinoyocraft@gmail.com', '$2b$10$wfcDxLuZWPYzSA5UeXj6HO2XU1xjLfaYD.fcGmH7I6fCsg8CZec2K', 'admin', 1, 0, NULL, NULL, '2026-10-10 23:32:11', '2026-10-11 18:54:07'),
(34, 'Aditya Karyudie', 'aditkaryudie@gmail.com', NULL, 'admin', 1, 0, '117542459585763900953', 'https://lh3.googleusercontent.com/a/ACg8ocIAzCOQLXeIHKft2sNVvFmwz_YaS9Km1KUc9ETkS2heMDRDPgFZ=s96-c', '2026-10-16 16:59:37', '2026-10-17 11:59:42'),
(37, 'Budi Pengrajin', 'budi.mitra@gmail.com', '$2b$10$x0QuoUd0WY8nt2DrNiXNle6oky6RUYlD0Yqpyo8upD0Mo6pOj6omO', 'mitra', 1, 0, NULL, NULL, '2026-10-17 13:46:53', '2026-10-17 14:03:42'),
(39, 'aditya', 'labgame211@gmail.com', '$2b$10$BtunGZCkmNvbavfvFuuixeQl9HzcTGMP/hhPucYHr08G4SIO6C70C', 'mitra', 1, 0, NULL, '/uploads/1792404100146-791381469.png', '2026-10-19 10:36:01', '2026-10-19 17:01:51');

-- Kategori Produk Keramik
INSERT IGNORE INTO `categories` (`id`, `name`, `description`, `image_url`, `created_at`) VALUES
(1, 'Dekorasi', 'Produk dekorasi keramik', NULL, '2026-10-19 17:34:08'),
(2, 'Peralatan Makan', 'Piring, cangkir, mangkuk, dsb', NULL, '2026-10-19 17:34:08'),
(3, 'Souvenir', 'Souvenir keramik khas Dinoyo', NULL, '2026-10-19 17:34:08'),
(4, 'Pot Tanaman', 'Pot keramik aneka ukuran', NULL, '2026-10-19 17:34:08');

-- Master Data Konfigurasi Platform
INSERT IGNORE INTO `master_data` (`id`, `category`, `key`, `value`, `description`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'KATEGORI_PRODUK', 'GERABAH_TRADISIONAL', 'Gerabah Tradisional', 'Produk gerabah bermotif tradisional Jawa', 1, '2026-10-10 23:32:11', '2026-10-10 23:32:11'),
(2, 'KATEGORI_PRODUK', 'KERAMIK_MODERN', 'Keramik Modern', 'Produk keramik dengan desain kontemporer', 1, '2026-10-10 23:32:11', '2026-10-10 23:32:11'),
(3, 'KATEGORI_PRODUK', 'SOUVENIR_WISATA', 'Souvenir Wisata', 'Produk souvenir untuk pariwisata Malang', 1, '2026-10-10 23:32:11', '2026-10-10 23:32:11'),
(4, 'STATUS_TRANSAKSI', 'PENDING', 'Menunggu Konfirmasi', 'Transaksi sedang menunggu verifikasi', 1, '2026-10-10 23:32:11', '2026-10-10 23:32:11');

-- Profil Mitra Awal
INSERT IGNORE INTO `mitra_profiles` (`id`, `user_id`, `whatsapp_number`, `store_name`, `workshop_address`, `started_year`, `description`, `website`, `instagram`, `banner_url`, `ktp_file_url`, `nib_file_url`, `sample_product_images`, `is_verified`, `is_active`, `created_at`, `updated_at`) VALUES
(10, 37, '0812345678', 'Keramik Budi Jaya', 'Jl. Dinoyo No 1', 2021, NULL, NULL, NULL, NULL, '/uploads/1792219613062-277608349.jpeg', '/uploads/1792219613066-440429651.jpg', '["/uploads/1792219613095-173114074.jpg", "/uploads/1792219613122-582619046.jpeg", "/uploads/1792219613123-669820079.jpeg"]', 1, 1, '2026-10-17 13:46:53', '2026-10-17 14:03:42'),
(12, 39, '082190220487', 'aditya', 'veteran', 2000, 'Studio keramik handmade dari tanah liat pilihan. Memproduksi vas, mug, piring hias, dan berbagai kerajinan keramik berkualitas tinggi.', 'https://studiokeramik.co.id', '@studiokeramikdinoyo', '/uploads/1792404111965-562271470.png', '/uploads/1792380961674-353743762.jpeg', '/uploads/1792380961689-982536270.jpeg', '["/uploads/1792380961703-759480403.jpg", "/uploads/1792380961711-379390400.jpeg", "/uploads/1792380961712-988870784.jpeg"]', 1, 1, '2026-10-19 10:36:01', '2026-10-19 17:01:51');

-- Sampel Produk Awal
INSERT IGNORE INTO `products` (`id`, `mitra_id`, `category_id`, `name`, `description`, `price`, `stock`, `weight_gram`, `image_urls`, `is_deleted`, `created_at`, `updated_at`) VALUES
(1, 12, 2, 'mangkok', 'mangkok', '200000.00', 12, 500, '["/uploads/1792406168310-495256600.png"]', 0, '2026-10-19 17:36:08', '2026-10-19 17:36:08'),
(2, 12, 2, 'sasa', 'sasa', '22222.00', 22, 500, '["/uploads/1792406188233-622154251.jpeg"]', 0, '2026-10-19 17:36:28', '2026-10-19 17:36:28');

-- Nyalakan kembali pengecekan Foreign Key
SET FOREIGN_KEY_CHECKS = 1;
