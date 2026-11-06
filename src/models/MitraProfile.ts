import { DataTypes, Model } from 'sequelize';
import db, { pool, sequelize } from '../config/database.js';

class MitraProfile extends Model {
  declare id: number;
  declare user_id: number;
  declare whatsapp_number: string;
  declare store_name: string;
  declare workshop_address: string;
  declare started_year: number | null;
  declare description: string | null;
  declare website: string | null;
  declare instagram: string | null;
  declare banner_url: string | null;
  declare avatar_url: string | null;
  declare ktp_file_url: string;
  declare nib_file_url: string;
  declare sample_product_images: string[] | string;
  declare is_verified: number;
  declare rejection_reason: string | null;
  declare is_active: number;
  declare created_at: Date;
  declare updated_at: Date;
}

MitraProfile.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    whatsapp_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    store_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    workshop_address: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    started_year: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    website: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    instagram: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: null,
    },
    banner_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: null,
    },
    avatar_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: null,
    },
    ktp_file_url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    nib_file_url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    sample_product_images: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    is_verified: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 0,
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    is_active: {
      type: DataTypes.TINYINT,
      allowNull: true,
      defaultValue: 1,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize: db,
    tableName: 'mitra_profiles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

/**
 * Memastikan tabel mitra_profiles memiliki seluruh kolom yang dibutuhkan
 * secara idempotent tanpa menghapus atau merusak data yang sudah ada.
 */
export const ensureMitraProfileSchema = async (): Promise<void> => {
  await MitraProfile.sync();

  const requiredColumns: Array<{ name: string; definition: string }> = [
    { name: 'description', definition: 'TEXT NULL AFTER `started_year`' },
    { name: 'website', definition: 'VARCHAR(255) DEFAULT NULL AFTER `description`' },
    { name: 'instagram', definition: 'VARCHAR(100) DEFAULT NULL AFTER `website`' },
    { name: 'banner_url', definition: 'VARCHAR(500) DEFAULT NULL AFTER `instagram`' },
    { name: 'avatar_url', definition: 'VARCHAR(500) DEFAULT NULL AFTER `banner_url`' },
    { name: 'rejection_reason', definition: 'TEXT DEFAULT NULL AFTER `is_verified`' },
  ];

  const [existingCols]: any = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'mitra_profiles'`
  );

  const existingSet = new Set(
    (existingCols || []).map((row: any) => String(row.COLUMN_NAME).toLowerCase())
  );

  for (const col of requiredColumns) {
    if (!existingSet.has(col.name.toLowerCase())) {
      await pool.query(
        `ALTER TABLE \`mitra_profiles\` ADD COLUMN \`${col.name}\` ${col.definition}`
      );
      console.log(`✅ Kolom mitra_profiles.${col.name} berhasil ditambahkan.`);
    }
  }

  // Sinkronisasi avatar_url mitra_profiles yang masih NULL dari users.avatar_url jika ada
  await pool.query(
    `UPDATE \`mitra_profiles\` m
     INNER JOIN \`users\` u ON m.user_id = u.id
     SET m.avatar_url = u.avatar_url
     WHERE m.avatar_url IS NULL AND u.avatar_url IS NOT NULL`
  );

  // Pastikan kolom profil tambahan (phone, birth_date, gender) di tabel users tersedia secara idempotent
  const [userCols]: any = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'`
  );
  const userColSet = new Set(
    (userCols || []).map((row: any) => String(row.COLUMN_NAME).toLowerCase())
  );
  const requiredUserCols = [
    { name: 'phone', definition: 'VARCHAR(30) DEFAULT NULL AFTER `avatar_url`' },
    { name: 'birth_date', definition: 'VARCHAR(30) DEFAULT NULL AFTER `phone`' },
    { name: 'gender', definition: 'VARCHAR(20) DEFAULT NULL AFTER `birth_date`' },
  ];
  for (const col of requiredUserCols) {
    if (!userColSet.has(col.name)) {
      await pool.query(`ALTER TABLE \`users\` ADD COLUMN \`${col.name}\` ${col.definition}`);
      console.log(`✅ Kolom users.${col.name} berhasil ditambahkan.`);
    }
  }

  // Pastikan kolom tambahan di tabel reviews tersedia secara idempotent
  const [reviewCols]: any = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'reviews'`
  );
  const reviewColSet = new Set(
    (reviewCols || []).map((row: any) => String(row.COLUMN_NAME).toLowerCase())
  );
  const requiredReviewCols = [
    { name: 'seller_reply', definition: 'TEXT DEFAULT NULL AFTER `comment`' },
    { name: 'variant', definition: 'VARCHAR(100) DEFAULT NULL AFTER `comment`' },
    { name: 'photo_urls', definition: 'JSON DEFAULT NULL AFTER `comment`' },
    { name: 'helpful_count', definition: 'INT DEFAULT 0 AFTER `comment`' },
  ];
  if (reviewCols && reviewCols.length > 0) {
    for (const col of requiredReviewCols) {
      if (!reviewColSet.has(col.name)) {
        await pool.query(`ALTER TABLE \`reviews\` ADD COLUMN \`${col.name}\` ${col.definition}`);
        console.log(`✅ Kolom reviews.${col.name} berhasil ditambahkan.`);
      }
    }
  }

  // Pastikan kolom description, icon_url, created_at di tabel categories tersedia secara idempotent
  const [catCols]: any = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'categories'`
  );
  const catColSet = new Set(
    (catCols || []).map((row: any) => String(row.COLUMN_NAME).toLowerCase())
  );
  if (catCols && catCols.length > 0) {
    if (!catColSet.has('description')) {
      await pool.query(`ALTER TABLE \`categories\` ADD COLUMN \`description\` TEXT DEFAULT NULL AFTER \`name\``);
      console.log(`✅ Kolom categories.description berhasil ditambahkan.`);
    }
    if (!catColSet.has('icon_url')) {
      await pool.query(`ALTER TABLE \`categories\` ADD COLUMN \`icon_url\` VARCHAR(500) DEFAULT NULL`);
      console.log(`✅ Kolom categories.icon_url berhasil ditambahkan.`);
    }
    if (!catColSet.has('created_at')) {
      await pool.query(`ALTER TABLE \`categories\` ADD COLUMN \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP`);
      console.log(`✅ Kolom categories.created_at berhasil ditambahkan.`);
    }
  }

  // Pastikan kolom tambahan di tabel orders tersedia secara idempotent
  const [orderCols]: any = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'orders'`
  );
  const orderColSet = new Set(
    (orderCols || []).map((row: any) => String(row.COLUMN_NAME).toLowerCase())
  );
  const requiredOrderCols = [
    { name: 'shipping_address', definition: 'TEXT DEFAULT NULL' },
    { name: 'shipping_method', definition: "VARCHAR(100) DEFAULT 'Regular'" },
    { name: 'shipping_cost', definition: 'DECIMAL(12,2) DEFAULT 0.00' },
    { name: 'product_amount', definition: 'DECIMAL(12,2) DEFAULT 0.00' },
    { name: 'application_fee', definition: 'DECIMAL(12,2) DEFAULT 0.00' },
    { name: 'voucher_discount', definition: 'DECIMAL(12,2) DEFAULT 0.00' },
    { name: 'total_due', definition: 'DECIMAL(12,2) DEFAULT 0.00' },
    { name: 'notes', definition: 'TEXT DEFAULT NULL' },
    { name: 'tracking_number', definition: 'VARCHAR(100) DEFAULT NULL' },
    { name: 'expires_at', definition: 'DATETIME DEFAULT NULL' },
  ];
  if (orderCols && orderCols.length > 0) {
    for (const col of requiredOrderCols) {
      if (!orderColSet.has(col.name)) {
        await pool.query(`ALTER TABLE \`orders\` ADD COLUMN \`${col.name}\` ${col.definition}`);
        console.log(`✅ Kolom orders.${col.name} berhasil ditambahkan.`);
      }
    }
  }

  // Pastikan kolom tambahan di tabel order_items tersedia secara idempotent
  const [oiCols]: any = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'order_items'`
  );
  const oiColSet = new Set(
    (oiCols || []).map((row: any) => String(row.COLUMN_NAME).toLowerCase())
  );
  const requiredOiCols = [
    { name: 'price_at_purchase', definition: 'DECIMAL(12,2) DEFAULT 0.00' },
    { name: 'unit_price', definition: 'DECIMAL(12,2) DEFAULT 0.00' },
    { name: 'variant', definition: 'VARCHAR(100) DEFAULT NULL' },
  ];
  if (oiCols && oiCols.length > 0) {
    for (const col of requiredOiCols) {
      if (!oiColSet.has(col.name)) {
        await pool.query(`ALTER TABLE \`order_items\` ADD COLUMN \`${col.name}\` ${col.definition}`);
        console.log(`✅ Kolom order_items.${col.name} berhasil ditambahkan.`);
      }
    }
    await pool
      .query(
        `UPDATE \`order_items\`
         SET price_at_purchase = COALESCE(NULLIF(price_at_purchase, 0), unit_price, 0),
             unit_price = COALESCE(NULLIF(unit_price, 0), price_at_purchase, 0)`
      )
      .catch(() => {});
  }

  // Pastikan kolom tambahan di tabel transactions tersedia secara idempotent
  const [txCols]: any = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'transactions'`
  );
  const txColSet = new Set(
    (txCols || []).map((row: any) => String(row.COLUMN_NAME).toLowerCase())
  );
  const requiredTxCols = [
    { name: 'order_id', definition: 'INT DEFAULT NULL' },
    { name: 'mitra_id', definition: 'INT DEFAULT NULL' },
    { name: 'payment_method', definition: "VARCHAR(50) DEFAULT 'QRIS'" },
    { name: 'qr_string', definition: 'TEXT DEFAULT NULL' },
    { name: 'notes', definition: 'TEXT DEFAULT NULL' },
    { name: 'updated_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' },
  ];
  if (txCols && txCols.length > 0) {
    for (const col of requiredTxCols) {
      if (!txColSet.has(col.name)) {
        await pool.query(`ALTER TABLE \`transactions\` ADD COLUMN \`${col.name}\` ${col.definition}`);
        console.log(`✅ Kolom transactions.${col.name} berhasil ditambahkan.`);
      }
    }
  }

  // Pastikan kolom tambahan di tabel educational_tours tersedia secara idempotent
  const [tourCols]: any = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'educational_tours'`
  );
  const tourColSet = new Set(
    (tourCols || []).map((row: any) => String(row.COLUMN_NAME).toLowerCase())
  );
  const requiredTourCols = [
    { name: 'agency_name', definition: "VARCHAR(255) DEFAULT 'Instansi'" },
    { name: 'visit_date', definition: 'DATE DEFAULT NULL' },
    { name: 'visit_time', definition: "VARCHAR(20) DEFAULT '09:00:00'" },
    { name: 'participant_count', definition: 'INT DEFAULT 1' },
    { name: 'pic_name', definition: "VARCHAR(150) DEFAULT '-'" },
    { name: 'pic_phone', definition: "VARCHAR(50) DEFAULT '-'" },
    { name: 'status', definition: "VARCHAR(50) DEFAULT 'pending'" },
    { name: 'notes', definition: 'TEXT DEFAULT NULL' },
    { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
    { name: 'updated_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' },
  ];
  if (tourCols && tourCols.length > 0) {
    for (const col of requiredTourCols) {
      if (!tourColSet.has(col.name)) {
        await pool.query(`ALTER TABLE \`educational_tours\` ADD COLUMN \`${col.name}\` ${col.definition}`);
        console.log(`✅ Kolom educational_tours.${col.name} berhasil ditambahkan.`);
      }
    }
  }
};

export { sequelize };
export default MitraProfile;

