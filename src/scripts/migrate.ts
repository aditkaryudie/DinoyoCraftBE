import db from '../config/database';

const tables = [
  // 1. users
  `CREATE TABLE IF NOT EXISTS \`users\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`name\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
    \`username\` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`phone\` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`birth_date\` date DEFAULT NULL,
    \`gender\` enum('L','P') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`email\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    \`password_hash\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`role\` enum('admin','mitra','pengunjung') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pengunjung',
    \`is_active\` tinyint(1) NOT NULL DEFAULT '1',
    \`token_version\` int UNSIGNED NOT NULL DEFAULT '0',
    \`google_id\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`avatar_url\` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`last_seen_at\` datetime DEFAULT NULL,
    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`uq_users_email\` (\`email\`),
    UNIQUE KEY \`uq_users_google_id\` (\`google_id\`),
    UNIQUE KEY \`uq_users_username\` (\`username\`)
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
    \`payment_token\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`inv_id\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`payment_url\` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`qr_string\` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`gateway_fee\` decimal(15,2) NOT NULL DEFAULT '0.00',
    \`gateway\` varchar(30) NOT NULL DEFAULT 'midtrans',
    \`gateway_order_id\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`payment_type\` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`va_number\` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`bank\` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`expiry_time\` datetime DEFAULT NULL,
    \`paid_at\` datetime DEFAULT NULL,
    \`gateway_response\` json DEFAULT NULL,
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
    \`type\` varchar(50) NOT NULL DEFAULT 'system',
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
    \`message\` text COLLATE utf8mb4_unicode_ci NOT NULL,
    \`image_url\` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    \`is_read\` tinyint(1) DEFAULT '0',
    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    KEY \`idx_messages_sender\` (\`sender_id\`),
    KEY \`idx_messages_receiver\` (\`receiver_id\`),
    FOREIGN KEY (\`sender_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`receiver_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 14. reports (Laporan Pengaduan)
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

  // 15. account_deletions (Penutupan Akun Mobile)
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

  // 17. master_data
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

  // 18. ai_analysis_results
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

  // 22. order_status_history — timeline pelacakan pesanan
  `CREATE TABLE IF NOT EXISTS \`order_status_history\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`order_id\` int UNSIGNED NOT NULL,
    \`status\` varchar(30) NOT NULL,
    \`tracking_number\` varchar(100) DEFAULT NULL,
    \`note\` varchar(255) DEFAULT NULL,
    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    KEY \`idx_osh_order\` (\`order_id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 23. user_device_tokens — token FCM per perangkat
  `CREATE TABLE IF NOT EXISTS \`user_device_tokens\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`user_id\` int UNSIGNED NOT NULL,
    \`fcm_token\` varchar(255) NOT NULL,
    \`platform\` varchar(20) NOT NULL DEFAULT 'android',
    \`updated_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`uq_fcm\` (\`fcm_token\`),
    KEY \`idx_udt_user\` (\`user_id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 24. withdrawal_requests — pengajuan tarik saldo mitra
  `CREATE TABLE IF NOT EXISTS \`withdrawal_requests\` (
    \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
    \`user_id\` int UNSIGNED NOT NULL,
    \`mitra_id\` int UNSIGNED NOT NULL,
    \`amount\` bigint NOT NULL,
    \`fee\` bigint NOT NULL DEFAULT 0,
    \`bank_name\` varchar(100) NOT NULL,
    \`account_number\` varchar(50) NOT NULL,
    \`account_name\` varchar(100) NOT NULL,
    \`status\` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    \`admin_note\` varchar(255) DEFAULT NULL,
    \`processed_by\` int UNSIGNED DEFAULT NULL,
    \`processed_at\` datetime DEFAULT NULL,
    \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    KEY \`idx_wr_user\` (\`user_id\`),
    KEY \`idx_wr_status\` (\`status\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 25. ai_settings — konfigurasi asisten AI / auto-reply
  `CREATE TABLE IF NOT EXISTS \`ai_settings\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`is_auto_reply_active\` tinyint(1) DEFAULT '0',
    \`model_name\` varchar(255) DEFAULT 'gemini-1.5-pro',
    \`api_key\` varchar(255) DEFAULT NULL,
    \`system_prompt\` text,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  // 26. system_logs — log & live monitoring admin
  `CREATE TABLE IF NOT EXISTS \`system_logs\` (
    \`id\` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
    \`event_id\` varchar(40) NOT NULL,
    \`occurred_at\` datetime(3) NOT NULL,
    \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`category\` varchar(50) NOT NULL,
    \`event_name\` varchar(120) NOT NULL,
    \`severity\` varchar(20) NOT NULL,
    \`outcome\` varchar(20) NOT NULL DEFAULT 'info',
    \`source\` varchar(30) NOT NULL DEFAULT 'backend',
    \`service\` varchar(60) NOT NULL DEFAULT 'api',
    \`http_method\` varchar(16) DEFAULT NULL,
    \`route_template\` varchar(255) DEFAULT NULL,
    \`status_code\` int DEFAULT NULL,
    \`duration_ms\` int DEFAULT NULL,
    \`request_id\` varchar(64) DEFAULT NULL,
    \`trace_id\` varchar(64) DEFAULT NULL,
    \`user_id\` int DEFAULT NULL,
    \`role\` varchar(30) DEFAULT NULL,
    \`order_id\` int DEFAULT NULL,
    \`transaction_id\` int DEFAULT NULL,
    \`reference_code\` varchar(100) DEFAULT NULL,
    \`message\` text NOT NULL,
    \`error_code\` varchar(80) DEFAULT NULL,
    \`error_name\` varchar(120) DEFAULT NULL,
    \`error_message\` text,
    \`error_stack\` text,
    \`metadata_json\` json DEFAULT NULL,
    \`ip_masked\` varchar(64) DEFAULT NULL,
    \`user_agent\` varchar(500) DEFAULT NULL,
    \`platform\` varchar(50) DEFAULT NULL,
    \`app_version\` varchar(50) DEFAULT NULL,
    \`acknowledged_at\` datetime DEFAULT NULL,
    \`acknowledged_by\` int DEFAULT NULL,
    \`deleted_at\` datetime DEFAULT NULL,
    \`deleted_by\` int DEFAULT NULL,
    \`delete_reason\` varchar(255) DEFAULT NULL,
    \`retention_expires_at\` datetime DEFAULT NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`uq_system_logs_event_id\` (\`event_id\`),
    KEY \`idx_system_logs_occurred_at\` (\`occurred_at\`, \`id\`),
    KEY \`idx_system_logs_category_occurred\` (\`category\`, \`occurred_at\`),
    KEY \`idx_system_logs_severity_occurred\` (\`severity\`, \`occurred_at\`),
    KEY \`idx_system_logs_request_id\` (\`request_id\`),
    KEY \`idx_system_logs_user_occurred\` (\`user_id\`, \`occurred_at\`),
    KEY \`idx_system_logs_order_id\` (\`order_id\`),
    KEY \`idx_system_logs_transaction_id\` (\`transaction_id\`),
    KEY \`idx_system_logs_status_occurred\` (\`status_code\`, \`occurred_at\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
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

    // 2. Eksekusi DDL pembuatan seluruh tabel (hanya struktur tabel, tanpa mengubah/mengisi data)
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

    await ensureColumn('transactions', 'payment_token', 'VARCHAR(255) NULL AFTER reference_code');
    await ensureColumn('transactions', 'inv_id', 'VARCHAR(255) NULL AFTER payment_token');
    await ensureColumn('transactions', 'payment_url', 'VARCHAR(500) NULL AFTER inv_id');
    await ensureColumn('transactions', 'qr_string', 'TEXT NULL AFTER payment_url');
    await ensureColumn('transactions', 'gateway_fee', 'DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER qr_string');

    // Kolom Midtrans (PRD_Midtrans_Sandbox §5.1)
    await ensureColumn('transactions', 'gateway', "VARCHAR(30) NOT NULL DEFAULT 'midtrans' AFTER gateway_fee");
    await ensureColumn('transactions', 'gateway_order_id', 'VARCHAR(100) NULL AFTER gateway');
    await ensureColumn('transactions', 'payment_type', 'VARCHAR(50) NULL AFTER gateway_order_id');
    await ensureColumn('transactions', 'va_number', 'VARCHAR(50) NULL AFTER payment_type');
    await ensureColumn('transactions', 'bank', 'VARCHAR(30) NULL AFTER va_number');
    await ensureColumn('transactions', 'expiry_time', 'DATETIME NULL AFTER bank');
    await ensureColumn('transactions', 'paid_at', 'DATETIME NULL AFTER expiry_time');
    await ensureColumn('transactions', 'gateway_response', 'JSON NULL AFTER paid_at');
    await ensureColumn('transactions', 'proof_image_url', 'VARCHAR(500) NULL AFTER notes');
    // gateway_order_id unik (multiple NULL diizinkan MySQL)
    try {
      await db.query('ALTER TABLE `transactions` ADD UNIQUE KEY `uq_gateway_order_id` (`gateway_order_id`)');
    } catch { /* sudah ada */ }

    await ensureColumn('users', 'username', 'VARCHAR(50) NULL AFTER name');
    await ensureColumn('users', 'phone', 'VARCHAR(20) NULL AFTER username');
    await ensureColumn('users', 'birth_date', 'DATE NULL AFTER phone');
    await ensureColumn('users', 'gender', "ENUM('L','P') NULL AFTER birth_date");
    await ensureColumn('users', 'last_seen_at', 'DATETIME NULL DEFAULT NULL AFTER updated_at');
    try {
      await db.query('ALTER TABLE \`users\` ADD UNIQUE KEY \`uq_users_username\` (\`username\`)');
    } catch { /* sudah ada */ }

    // Notifications versi lama memakai body/data — kode memakai message/reference_id
    await ensureColumn('notifications', 'message', 'TEXT NOT NULL AFTER title');
    await ensureColumn('notifications', 'reference_id', 'INT UNSIGNED NULL AFTER type');

    // Reviews versi lama tidak punya kolom ulasan lengkap
    await ensureColumn('reviews', 'order_item_id', 'INT UNSIGNED NULL AFTER id');
    await ensureColumn('reviews', 'variant', 'VARCHAR(100) NULL AFTER rating');
    await ensureColumn('reviews', 'comment', 'TEXT NULL AFTER variant');
    await ensureColumn('reviews', 'photo_urls', 'JSON NULL AFTER comment');
    await ensureColumn('reviews', 'helpful_count', "INT UNSIGNED NOT NULL DEFAULT 0 AFTER photo_urls");
    await ensureColumn('reviews', 'seller_reply', 'TEXT NULL AFTER helpful_count');
    await ensureColumn('reviews', 'replied_at', 'DATETIME NULL AFTER seller_reply');

    // Kolom lain yang pernah ditambahkan sepanjang riwayat proyek
    await ensureColumn('products', 'is_deleted', 'TINYINT(1) DEFAULT 0 AFTER total_reviews');
    await ensureColumn('mitra_profiles', 'avatar_url', 'VARCHAR(500) NULL AFTER banner_url');
    await ensureColumn('mitra_profiles', 'banner_url', 'VARCHAR(500) NULL AFTER instagram');

    await ensureColumn('order_items', 'variant', 'VARCHAR(100) NULL AFTER product_id');

    // Kolom media chat untuk tabel messages lama
    await ensureColumn('messages', 'image_url', 'VARCHAR(500) NULL AFTER message');

    // Kolom moderasi (reports & account_deletions) untuk skema lama
    await ensureColumn('reports', 'reporter_name', "VARCHAR(150) NOT NULL DEFAULT '' AFTER reporter_id");
    await ensureColumn('reports', 'type', "VARCHAR(50) NOT NULL DEFAULT 'toko' AFTER reporter_name");
    await ensureColumn('reports', 'target_name', "VARCHAR(255) NOT NULL DEFAULT '' AFTER target_id");
    await ensureColumn('reports', 'resolved_at', 'DATETIME NULL AFTER status');

    await ensureColumn('account_deletions', 'name', "VARCHAR(100) NOT NULL DEFAULT '' AFTER user_id");
    await ensureColumn('account_deletions', 'email', "VARCHAR(255) NOT NULL DEFAULT '' AFTER name");
    await ensureColumn('account_deletions', 'resolved_at', 'DATETIME NULL AFTER status');
    await ensureColumn('account_deletions', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER resolved_at');
    await ensureColumn('account_deletions', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');

    // Kolom type notifikasi fleksibel (DB lama sempat berupa ENUM yang menolak
    // nilai baru seperti 'withdrawal').
    await db.query("ALTER TABLE `notifications` MODIFY `type` varchar(50) NOT NULL DEFAULT 'system'");

    // 4. Hidupkan kembali Foreign Key check
    await db.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('✅ Migrasi & Sinkronisasi Struktur Tabel Berhasil! Data eksisting tetap aman.');
  } catch (error) {
    console.error('❌ Terjadi kesalahan saat migrasi:', error);
  } finally {
    process.exit();
  }
};

runMigration();
