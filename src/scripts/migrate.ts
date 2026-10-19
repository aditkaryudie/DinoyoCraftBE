import db from '../config/database';

const migrations = [
  // 1. Matikan pengecekan Foreign Key sementara agar tidak error urutan tabel
  "SET FOREIGN_KEY_CHECKS = 0;",

  // ==========================================
  // 2. CREATE TABLES (DENGAN RELASI)
  // ==========================================
  `CREATE TABLE IF NOT EXISTS \`users\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`name\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
    \`email\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    \`password_hash\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`role\` enum('admin','mitra','pengunjung') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'mitra',
    \`is_active\` tinyint(1) NOT NULL DEFAULT '1',
    \`token_version\` int UNSIGNED NOT NULL DEFAULT '0',
    \`google_id\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`avatar_url\` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`uq_users_email\` (\`email\`),
    UNIQUE KEY \`uq_users_google_id\` (\`google_id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`user_addresses\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`user_id\` int UNSIGNED NOT NULL,
    \`recipient_name\` varchar(100) NOT NULL,
    \`phone\` varchar(20) NOT NULL,
    \`full_address\` text NOT NULL,
    \`is_default\` tinyint(1) DEFAULT '0',
    \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`,

  `CREATE TABLE IF NOT EXISTS \`mitra_profiles\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`user_id\` int UNSIGNED NOT NULL,
    \`whatsapp_number\` varchar(20) NOT NULL,
    \`store_name\` varchar(150) NOT NULL,
    \`workshop_address\` text NOT NULL,
    \`started_year\` year DEFAULT NULL,
    \`description\` text,
    \`website\` varchar(255) DEFAULT NULL,
    \`instagram\` varchar(100) DEFAULT NULL,
    \`banner_url\` varchar(500) DEFAULT NULL,
    \`ktp_file_url\` varchar(500) NOT NULL,
    \`nib_file_url\` varchar(500) NOT NULL,
    \`sample_product_images\` json NOT NULL,
    \`is_verified\` tinyint(1) DEFAULT '0',
    \`is_active\` tinyint(1) DEFAULT '1',
    \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`,

  `CREATE TABLE IF NOT EXISTS \`categories\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`name\` varchar(100) NOT NULL,
    \`description\` text,
    \`image_url\` varchar(500) DEFAULT NULL,
    \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`,

  `CREATE TABLE IF NOT EXISTS \`products\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`mitra_id\` int UNSIGNED NOT NULL,
    \`category_id\` int UNSIGNED NOT NULL,
    \`name\` varchar(200) NOT NULL,
    \`description\` text,
    \`price\` decimal(15,2) NOT NULL,
    \`stock\` int NOT NULL DEFAULT '0',
    \`image_urls\` json DEFAULT NULL,
    \`is_deleted\` tinyint(1) DEFAULT '0',
    \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`mitra_id\`) REFERENCES \`mitra_profiles\` (\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`category_id\`) REFERENCES \`categories\` (\`id\`) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`,

  `CREATE TABLE IF NOT EXISTS \`carts\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`user_id\` int UNSIGNED NOT NULL,
    \`product_id\` int UNSIGNED NOT NULL,
    \`quantity\` int NOT NULL DEFAULT '1',
    \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`,

  `CREATE TABLE IF NOT EXISTS \`transactions\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`user_id\` int UNSIGNED NOT NULL,
    \`transaction_type\` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
    \`amount\` decimal(15,2) NOT NULL DEFAULT '0.00',
    \`status\` enum('pending','success','failed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
    \`reference_code\` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
    \`notes\` text COLLATE utf8mb4_unicode_ci,
    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`uq_transactions_reference_code\` (\`reference_code\`),
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`orders\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`user_id\` int UNSIGNED NOT NULL,
    \`mitra_id\` int UNSIGNED NOT NULL,
    \`address_id\` int UNSIGNED DEFAULT NULL,
    \`transaction_id\` int UNSIGNED DEFAULT NULL,
    \`total_amount\` decimal(15,2) NOT NULL,
    \`shipping_cost\` decimal(15,2) NOT NULL DEFAULT '0.00',
    \`status\` enum('pending','paid','packed','shipped','completed','cancelled') DEFAULT 'pending',
    \`tracking_number\` varchar(100) DEFAULT NULL,
    \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`mitra_id\`) REFERENCES \`mitra_profiles\` (\`id\`),
    FOREIGN KEY (\`address_id\`) REFERENCES \`user_addresses\` (\`id\`) ON DELETE SET NULL,
    FOREIGN KEY (\`transaction_id\`) REFERENCES \`transactions\` (\`id\`) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`,

  `CREATE TABLE IF NOT EXISTS \`order_items\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`order_id\` int UNSIGNED NOT NULL,
    \`product_id\` int UNSIGNED NOT NULL,
    \`quantity\` int NOT NULL,
    \`unit_price\` decimal(15,2) NOT NULL,
    \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`,

  `CREATE TABLE IF NOT EXISTS \`ai_analysis_results\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`user_id\` int UNSIGNED NOT NULL,
    \`prompt_context\` text COLLATE utf8mb4_unicode_ci NOT NULL,
    \`ai_response\` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    \`model_used\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
    \`tokens_used\` int UNSIGNED DEFAULT NULL,
    \`processing_time_ms\` int UNSIGNED DEFAULT NULL,
    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`audit_logs\` (
    \`id\` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
    \`user_id\` int UNSIGNED DEFAULT NULL,
    \`action\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    \`table_name\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`record_id\` int UNSIGNED DEFAULT NULL,
    \`old_values\` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
    \`new_values\` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
    \`ip_address\` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`user_agent\` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`educational_tours\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`title\` varchar(200) NOT NULL,
    \`description\` text,
    \`image_url\` varchar(500) DEFAULT NULL,
    \`whatsapp_number\` varchar(20) DEFAULT NULL,
    \`created_by\` int UNSIGNED DEFAULT NULL,
    \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`,

  `CREATE TABLE IF NOT EXISTS \`master_data\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`category\` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
    \`key\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
    \`value\` text COLLATE utf8mb4_unicode_ci NOT NULL,
    \`description\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`created_by\` int UNSIGNED NOT NULL,
    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`uq_master_data_category_key\` (\`category\`,\`key\`),
    FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // ==========================================
  // 3. SEEDING / INSERT DATA (DENGAN IGNORE AGAR AMAN JIKA DI-RUN ULANG)
  // ==========================================
  `INSERT IGNORE INTO \`users\` (\`id\`, \`name\`, \`email\`, \`password_hash\`, \`role\`, \`is_active\`, \`token_version\`, \`google_id\`, \`avatar_url\`, \`created_at\`, \`updated_at\`) VALUES
  (1, 'Super Admin', 'admin@dinoyocraft.com', '$2a$12$I/yJhrmxLwKaFmg8RfScouTjVh9g631hmQb4ViQ5BDEd.UmBYH8dq', 'admin', 1, 0, NULL, NULL, '2026-10-10 23:32:11', '2026-10-11 18:54:07'),
  (34, 'Aditya Karyudie', 'aditkaryudie@gmail.com', NULL, 'admin', 1, 0, '117542459585763900953', 'https://lh3.googleusercontent.com/a/ACg8ocIAzCOQLXeIHKft2sNVvFmwz_YaS9Km1KUc9ETkS2heMDRDPgFZ=s96-c', '2026-10-16 16:59:37', '2026-10-17 11:59:42'),
  (37, 'Budi Pengrajin', 'budi.mitra@gmail.com', '$2b$10$x0QuoUd0WY8nt2DrNiXNle6oky6RUYlD0Yqpyo8upD0Mo6pOj6omO', 'mitra', 1, 0, NULL, NULL, '2026-10-17 13:46:53', '2026-10-17 14:03:42'),
  (39, 'aditya', 'labgame211@gmail.com', '$2b$10$BtunGZCkmNvbavfvFuuixeQl9HzcTGMP/hhPucYHr08G4SIO6C70C', 'mitra', 1, 0, NULL, '/uploads/1792404100146-791381469.png', '2026-10-19 10:36:01', '2026-10-19 17:01:51');`,

  `INSERT IGNORE INTO \`categories\` (\`id\`, \`name\`, \`description\`, \`image_url\`, \`created_at\`) VALUES
  (1, 'Dekorasi', 'Produk dekorasi keramik', NULL, '2026-10-19 17:34:08'),
  (2, 'Peralatan Makan', 'Piring, cangkir, mangkuk, dsb', NULL, '2026-10-19 17:34:08'),
  (3, 'Souvenir', 'Souvenir keramik khas Dinoyo', NULL, '2026-10-19 17:34:08'),
  (4, 'Pot Tanaman', 'Pot keramik aneka ukuran', NULL, '2026-10-19 17:34:08');`,

  `INSERT IGNORE INTO \`master_data\` (\`id\`, \`category\`, \`key\`, \`value\`, \`description\`, \`created_by\`, \`created_at\`, \`updated_at\`) VALUES
  (1, 'KATEGORI_PRODUK', 'GERABAH_TRADISIONAL', 'Gerabah Tradisional', 'Produk gerabah bermotif tradisional Jawa', 1, '2026-10-10 23:32:11', '2026-10-10 23:32:11'),
  (2, 'KATEGORI_PRODUK', 'KERAMIK_MODERN', 'Keramik Modern', 'Produk keramik dengan desain kontemporer', 1, '2026-10-10 23:32:11', '2026-10-10 23:32:11'),
  (3, 'KATEGORI_PRODUK', 'SOUVENIR_WISATA', 'Souvenir Wisata', 'Produk souvenir untuk pariwisata Malang', 1, '2026-10-10 23:32:11', '2026-10-10 23:32:11'),
  (4, 'STATUS_TRANSAKSI', 'PENDING', 'Menunggu Konfirmasi', 'Transaksi sedang menunggu verifikasi', 1, '2026-10-10 23:32:11', '2026-10-10 23:32:11');`,

  `INSERT IGNORE INTO \`mitra_profiles\` (\`id\`, \`user_id\`, \`whatsapp_number\`, \`store_name\`, \`workshop_address\`, \`started_year\`, \`description\`, \`website\`, \`instagram\`, \`banner_url\`, \`ktp_file_url\`, \`nib_file_url\`, \`sample_product_images\`, \`is_verified\`, \`is_active\`, \`created_at\`, \`updated_at\`) VALUES
  (10, 37, '0812345678', 'Keramik Budi Jaya', 'Jl. Dinoyo No 1', 2021, NULL, NULL, NULL, NULL, '/uploads/1792219613062-277608349.jpeg', '/uploads/1792219613066-440429651.jpg', '["/uploads/1792219613095-173114074.jpg", "/uploads/1792219613122-582619046.jpeg", "/uploads/1792219613123-669820079.jpeg"]', 1, 1, '2026-10-17 13:46:53', '2026-10-17 14:03:42'),
  (12, 39, '082190220487', 'aditya', 'veteran', 2000, 'Studio keramik handmade dari tanah liat pilihan. Memproduksi vas, mug, piring hias, dan berbagai kerajinan keramik berkualitas tinggi.', 'https://studiokeramik.co.id', '@studiokeramikdinoyo', '/uploads/1792404111965-562271470.png', '/uploads/1792380961674-353743762.jpeg', '/uploads/1792380961689-982536270.jpeg', '["/uploads/1792380961703-759480403.jpg", "/uploads/1792380961711-379390400.jpeg", "/uploads/1792380961712-988870784.jpeg"]', 1, 1, '2026-10-19 10:36:01', '2026-10-19 17:01:51');`,

  `INSERT IGNORE INTO \`products\` (\`id\`, \`mitra_id\`, \`category_id\`, \`name\`, \`description\`, \`price\`, \`stock\`, \`image_urls\`, \`is_deleted\`, \`created_at\`, \`updated_at\`) VALUES
  (1, 12, 2, 'mangkok', 'mangkok', '200000.00', 12, '["/uploads/1792406168310-495256600.png"]', 0, '2026-10-19 17:36:08', '2026-10-19 17:36:08'),
  (2, 12, 2, 'sasa', 'sasa', '22222.00', 22, '["/uploads/1792406188233-622154251.jpeg"]', 0, '2026-10-19 17:36:28', '2026-10-19 17:36:28');`,

  // 4. Nyalakan kembali pengecekan Foreign Key
  "SET FOREIGN_KEY_CHECKS = 1;"
];

const runMigration = async () => {
  console.log('🚀 Memulai migrasi database DinoyoCraft...');
  try {
    for (let i = 0; i < migrations.length; i++) {
      await db.query(migrations[i]);
    }
    console.log('✅ Migrasi & Sinkronisasi Data berhasil! Database siap digunakan.');
  } catch (error) {
    console.error('❌ Terjadi kesalahan saat migrasi:', error);
  } finally {
    process.exit();
  }
};

runMigration();