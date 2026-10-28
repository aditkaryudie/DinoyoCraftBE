import db from '../config/database';

const tables = [
  // 1. users
  `CREATE TABLE IF NOT EXISTS \`users\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`name\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
    \`email\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    \`password_hash\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`role\` enum('admin','mitra','pengunjung') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pengunjung',
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

  // 2. user_addresses
  `CREATE TABLE IF NOT EXISTS \`user_addresses\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`user_id\` int UNSIGNED NOT NULL,
    \`recipient_name\` varchar(100) NOT NULL,
    \`phone\` varchar(20) NOT NULL,
    \`full_address\` text NOT NULL,
    \`city\` varchar(100) DEFAULT NULL,
    \`postal_code\` varchar(20) DEFAULT NULL,
    \`label\` varchar(50) DEFAULT 'Rumah',
    \`is_default\` tinyint(1) DEFAULT '0',
    \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 3. user_otps (Penyimpanan OTP Persisten)
  `CREATE TABLE IF NOT EXISTS \`user_otps\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`user_id\` int UNSIGNED NOT NULL,
    \`otp_code\` varchar(10) NOT NULL,
    \`otp_type\` enum('register','reset_password','login') NOT NULL DEFAULT 'reset_password',
    \`expires_at\` datetime NOT NULL,
    \`is_used\` tinyint(1) NOT NULL DEFAULT '0',
    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 4. mitra_profiles
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
    \`avatar_url\` varchar(500) DEFAULT NULL,
    \`ktp_file_url\` varchar(500) NOT NULL,
    \`nib_file_url\` varchar(500) NOT NULL,
    \`sample_product_images\` json NOT NULL,
    \`is_verified\` tinyint(1) DEFAULT '0',
    \`rejection_reason\` text DEFAULT NULL,
    \`is_active\` tinyint(1) DEFAULT '1',
    \`rating\` decimal(3,2) DEFAULT '0.00',
    \`total_reviews\` int DEFAULT '0',
    \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 5. categories
  `CREATE TABLE IF NOT EXISTS \`categories\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`name\` varchar(100) NOT NULL,
    \`description\` text,
    \`image_url\` varchar(500) DEFAULT NULL,
    \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 6. products
  `CREATE TABLE IF NOT EXISTS \`products\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`mitra_id\` int UNSIGNED NOT NULL,
    \`category_id\` int UNSIGNED NOT NULL,
    \`name\` varchar(200) NOT NULL,
    \`description\` text,
    \`price\` decimal(15,2) NOT NULL,
    \`stock\` int NOT NULL DEFAULT '0',
    \`weight_gram\` int NOT NULL DEFAULT '500',
    \`variants\` json DEFAULT NULL,
    \`image_urls\` json DEFAULT NULL,
    \`rating\` decimal(3,2) DEFAULT '0.00',
    \`total_reviews\` int DEFAULT '0',
    \`is_deleted\` tinyint(1) DEFAULT '0',
    \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`mitra_id\`) REFERENCES \`mitra_profiles\` (\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`category_id\`) REFERENCES \`categories\` (\`id\`) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 7. carts
  `CREATE TABLE IF NOT EXISTS \`carts\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`user_id\` int UNSIGNED NOT NULL,
    \`product_id\` int UNSIGNED NOT NULL,
    \`variant\` varchar(100) DEFAULT NULL,
    \`quantity\` int NOT NULL DEFAULT '1',
    \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 8. transactions
  `CREATE TABLE IF NOT EXISTS \`transactions\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`user_id\` int UNSIGNED NOT NULL,
    \`transaction_type\` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
    \`amount\` decimal(15,2) NOT NULL DEFAULT '0.00',
    \`status\` enum('pending','success','failed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
    \`reference_code\` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
    \`notes\` text COLLATE utf8mb4_unicode_ci,
    \`proof_image_url\` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`uq_transactions_reference_code\` (\`reference_code\`),
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 9. orders
  `CREATE TABLE IF NOT EXISTS \`orders\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`user_id\` int UNSIGNED NOT NULL,
    \`mitra_id\` int UNSIGNED NOT NULL,
    \`address_id\` int UNSIGNED DEFAULT NULL,
    \`transaction_id\` int UNSIGNED DEFAULT NULL,
    \`total_amount\` decimal(15,2) NOT NULL,
    \`shipping_cost\` decimal(15,2) NOT NULL DEFAULT '0.00',
    \`shipping_method\` varchar(100) DEFAULT 'Reguler',
    \`tracking_number\` varchar(100) DEFAULT NULL,
    \`customer_notes\` text DEFAULT NULL,
    \`status\` enum('pending','paid','packed','shipped','completed','cancelled') DEFAULT 'pending',
    \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`mitra_id\`) REFERENCES \`mitra_profiles\` (\`id\`),
    FOREIGN KEY (\`address_id\`) REFERENCES \`user_addresses\` (\`id\`) ON DELETE SET NULL,
    FOREIGN KEY (\`transaction_id\`) REFERENCES \`transactions\` (\`id\`) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 10. order_items
  `CREATE TABLE IF NOT EXISTS \`order_items\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`order_id\` int UNSIGNED NOT NULL,
    \`product_id\` int UNSIGNED NOT NULL,
    \`variant\` varchar(100) DEFAULT NULL,
    \`quantity\` int NOT NULL,
    \`unit_price\` decimal(15,2) NOT NULL,
    \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 11. reviews (Ulasan Produk)
  `CREATE TABLE IF NOT EXISTS \`reviews\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`order_item_id\` int UNSIGNED DEFAULT NULL,
    \`product_id\` int UNSIGNED NOT NULL,
    \`user_id\` int UNSIGNED NOT NULL,
    \`rating\` tinyint UNSIGNED NOT NULL DEFAULT '5',
    \`variant\` varchar(100) DEFAULT NULL,
    \`comment\` text DEFAULT NULL,
    \`photo_urls\` json DEFAULT NULL,
    \`helpful_count\` int UNSIGNED DEFAULT '0',
    \`seller_reply\` text DEFAULT NULL,
    \`replied_at\` datetime DEFAULT NULL,
    \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`order_item_id\`) REFERENCES \`order_items\` (\`id\`) ON DELETE SET NULL,
    FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 12. notifications (Notifikasi User & Toko)
  `CREATE TABLE IF NOT EXISTS \`notifications\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`user_id\` int UNSIGNED NOT NULL,
    \`title\` varchar(200) NOT NULL,
    \`message\` text NOT NULL,
    \`type\` enum('order','mitra','promo','system') NOT NULL DEFAULT 'system',
    \`reference_id\` int UNSIGNED DEFAULT NULL,
    \`is_read\` tinyint(1) NOT NULL DEFAULT '0',
    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 13. messages (Live Chat Customer - Mitra)
  `CREATE TABLE IF NOT EXISTS \`messages\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`sender_id\` int UNSIGNED NOT NULL,
    \`receiver_id\` int UNSIGNED NOT NULL,
    \`message\` text NOT NULL,
    \`is_read\` tinyint(1) NOT NULL DEFAULT '0',
    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`sender_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`receiver_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 14. reports (Laporan Pengaduan)
  `CREATE TABLE IF NOT EXISTS \`reports\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`reporter_id\` int UNSIGNED NOT NULL,
    \`target_type\` enum('product','mitra','review','user') NOT NULL,
    \`target_id\` int UNSIGNED NOT NULL,
    \`reason\` text NOT NULL,
    \`status\` enum('pending','investigating','resolved','dismissed') NOT NULL DEFAULT 'pending',
    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`reporter_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 15. account_deletions (Penutupan Akun Mobile)
  `CREATE TABLE IF NOT EXISTS \`account_deletions\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`user_id\` int UNSIGNED NOT NULL,
    \`reason\` text DEFAULT NULL,
    \`status\` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    \`requested_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`processed_at\` datetime DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 16. audit_logs
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

  // 17. educational_tours & master_data & ai_analysis_results
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

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

  `CREATE TABLE IF NOT EXISTS \`messages\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`sender_id\` int UNSIGNED NOT NULL,
    \`receiver_id\` int UNSIGNED NOT NULL,
    \`message\` text COLLATE utf8mb4_unicode_ci NOT NULL,
    \`is_read\` tinyint(1) DEFAULT '0',
    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    KEY \`idx_messages_sender\` (\`sender_id\`),
    KEY \`idx_messages_receiver\` (\`receiver_id\`),
    FOREIGN KEY (\`sender_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`receiver_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`reports\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`reporter_id\` int UNSIGNED DEFAULT NULL,
    \`reporter_name\` varchar(150) NOT NULL,
    \`type\` varchar(50) NOT NULL,
    \`target_id\` int UNSIGNED DEFAULT NULL,
    \`target_name\` varchar(255) NOT NULL,
    \`reason\` text NOT NULL,
    \`status\` varchar(50) NOT NULL DEFAULT 'pending',
    \`resolved_at\` datetime DEFAULT NULL,
    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`account_deletions\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`user_id\` int UNSIGNED DEFAULT NULL,
    \`name\` varchar(100) NOT NULL,
    \`email\` varchar(255) NOT NULL,
    \`reason\` text NOT NULL,
    \`status\` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    \`resolved_at\` datetime DEFAULT NULL,
    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
];

const seeds = [
  // Super Admin & Sample Users
  `INSERT IGNORE INTO \`users\` (\`id\`, \`name\`, \`email\`, \`password_hash\`, \`role\`, \`is_active\`, \`token_version\`, \`google_id\`, \`avatar_url\`, \`created_at\`, \`updated_at\`) VALUES
  (1, 'Super Admin', 'csdinoyocraft@gmail.com', '$2b$10$wfcDxLuZWPYzSA5UeXj6HO2XU1xjLfaYD.fcGmH7I6fCsg8CZec2K', 'admin', 1, 0, NULL, NULL, '2026-10-10 23:32:11', '2026-10-11 18:54:07'),
  (34, 'Aditya Karyudie', 'aditkaryudie@gmail.com', NULL, 'admin', 1, 0, '117542459585763900953', 'https://lh3.googleusercontent.com/a/ACg8ocIAzCOQLXeIHKft2sNVvFmwz_YaS9Km1KUc9ETkS2heMDRDPgFZ=s96-c', '2026-10-16 16:59:37', '2026-10-17 11:59:42'),
  (37, 'Budi Pengrajin', 'budi.mitra@gmail.com', '$2b$10$x0QuoUd0WY8nt2DrNiXNle6oky6RUYlD0Yqpyo8upD0Mo6pOj6omO', 'mitra', 1, 0, NULL, NULL, '2026-10-17 13:46:53', '2026-10-17 14:03:42'),
  (39, 'aditya', 'labgame211@gmail.com', '$2b$10$BtunGZCkmNvbavfvFuuixeQl9HzcTGMP/hhPucYHr08G4SIO6C70C', 'mitra', 1, 0, NULL, '/uploads/1792404100146-791381469.png', '2026-10-19 10:36:01', '2026-10-19 17:01:51');`,

  // Categories
  `INSERT IGNORE INTO \`categories\` (\`id\`, \`name\`, \`description\`, \`image_url\`, \`created_at\`) VALUES
  (1, 'Dekorasi', 'Produk dekorasi keramik', NULL, '2026-10-19 17:34:08'),
  (2, 'Peralatan Makan', 'Piring, cangkir, mangkuk, dsb', NULL, '2026-10-19 17:34:08'),
  (3, 'Souvenir', 'Souvenir keramik khas Dinoyo', NULL, '2026-10-19 17:34:08'),
  (4, 'Pot Tanaman', 'Pot keramik aneka ukuran', NULL, '2026-10-19 17:34:08');`,

  // Master Data
  `INSERT IGNORE INTO \`master_data\` (\`id\`, \`category\`, \`key\`, \`value\`, \`description\`, \`created_by\`, \`created_at\`, \`updated_at\`) VALUES
  (1, 'KATEGORI_PRODUK', 'GERABAH_TRADISIONAL', 'Gerabah Tradisional', 'Produk gerabah bermotif tradisional Jawa', 1, '2026-10-10 23:32:11', '2026-10-10 23:32:11'),
  (2, 'KATEGORI_PRODUK', 'KERAMIK_MODERN', 'Keramik Modern', 'Produk keramik dengan desain kontemporer', 1, '2026-10-10 23:32:11', '2026-10-10 23:32:11'),
  (3, 'KATEGORI_PRODUK', 'SOUVENIR_WISATA', 'Souvenir Wisata', 'Produk souvenir untuk pariwisata Malang', 1, '2026-10-10 23:32:11', '2026-10-10 23:32:11'),
  (4, 'STATUS_TRANSAKSI', 'PENDING', 'Menunggu Konfirmasi', 'Transaksi sedang menunggu verifikasi', 1, '2026-10-10 23:32:11', '2026-10-10 23:32:11');`
];

// Helper aman untuk menambahkan kolom ke tabel yang sudah ada jika belum tersedia
const ensureColumn = async (tableName: string, columnName: string, columnDef: string) => {
  try {
    const [cols]: any = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [tableName, columnName]
    );
    if (!cols || cols.length === 0) {
      console.log(`  ➕ Menambahkan kolom [${columnName}] ke tabel [${tableName}]...`);
      await db.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDef}`);
    }
  } catch (err) {
    console.warn(`  ⚠️ Gagal memeriksa/menambahkan kolom ${columnName} pada ${tableName}:`, err);
  }
};

const runMigration = async () => {
  console.log('🚀 Memulai migrasi database DinoyoCraft...');
  try {
    // 1. Matikan Foreign Key check agar urutan tabel aman
    await db.query('SET FOREIGN_KEY_CHECKS = 0;');

    // 2. Eksekusi DDL pembuatan seluruh tabel
    console.log('📦 Membuat tabel database (jika belum ada)...');
    for (const tableSql of tables) {
      await db.query(tableSql);
    }

    // 3. Sinkronisasi kolom tambahan non-destructive untuk database yang sudah terisi
    console.log('🔄 Memeriksa & menyinkronkan kolom tambahan...');
    await ensureColumn('mitra_profiles', 'rejection_reason', 'TEXT NULL AFTER is_verified');
    await ensureColumn('mitra_profiles', 'rating', 'DECIMAL(3,2) DEFAULT 0.00 AFTER is_active');
    await ensureColumn('mitra_profiles', 'total_reviews', 'INT DEFAULT 0 AFTER rating');

    await ensureColumn('products', 'weight_gram', 'INT NOT NULL DEFAULT 500 AFTER stock');
    await ensureColumn('products', 'variants', 'JSON NULL AFTER weight_gram');
    await ensureColumn('products', 'rating', 'DECIMAL(3,2) DEFAULT 0.00 AFTER image_urls');
    await ensureColumn('products', 'total_reviews', 'INT DEFAULT 0 AFTER rating');

    await ensureColumn('carts', 'variant', 'VARCHAR(100) NULL AFTER product_id');

    await ensureColumn('user_addresses', 'city', 'VARCHAR(100) NULL AFTER full_address');
    await ensureColumn('user_addresses', 'postal_code', 'VARCHAR(20) NULL AFTER city');
    await ensureColumn('user_addresses', 'label', "VARCHAR(50) DEFAULT 'Rumah' AFTER postal_code");

    await ensureColumn('orders', 'shipping_method', "VARCHAR(100) DEFAULT 'Reguler' AFTER shipping_cost");
    await ensureColumn('orders', 'customer_notes', 'TEXT NULL AFTER tracking_number');

    await ensureColumn('order_items', 'variant', 'VARCHAR(100) NULL AFTER product_id');

    // 4. Seeding data awal aman (INSERT IGNORE)
    console.log('🌱 Menyuntikkan seed data awal (Super Admin & Kategori)...');
    for (const seedSql of seeds) {
      await db.query(seedSql);
    }

    // 5. Hidupkan kembali Foreign Key check
    await db.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('✅ Migrasi & Sinkronisasi 17 Tabel Database Berhasil! Database siap digunakan.');
  } catch (error) {
    console.error('❌ Terjadi kesalahan saat migrasi:', error);
  } finally {
    process.exit();
  }
};

runMigration();
