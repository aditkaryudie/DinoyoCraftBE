"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = exports.ensureMitraProfileSchema = void 0;
const sequelize_1 = require("sequelize");
const database_js_1 = __importStar(require("../config/database.js"));
Object.defineProperty(exports, "sequelize", { enumerable: true, get: function () { return database_js_1.sequelize; } });
class MitraProfile extends sequelize_1.Model {
}
MitraProfile.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
    },
    user_id: {
        type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    whatsapp_number: {
        type: sequelize_1.DataTypes.STRING(20),
        allowNull: false,
    },
    store_name: {
        type: sequelize_1.DataTypes.STRING(150),
        allowNull: false,
    },
    workshop_address: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
    },
    started_year: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
    },
    website: {
        type: sequelize_1.DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
    },
    instagram: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
    },
    banner_url: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: true,
        defaultValue: null,
    },
    avatar_url: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: true,
        defaultValue: null,
    },
    ktp_file_url: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: false,
    },
    nib_file_url: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: false,
    },
    sample_product_images: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
    },
    is_verified: {
        type: sequelize_1.DataTypes.TINYINT,
        allowNull: true,
        defaultValue: 0,
    },
    rejection_reason: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
    },
    is_active: {
        type: sequelize_1.DataTypes.TINYINT,
        allowNull: true,
        defaultValue: 1,
    },
    created_at: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
    updated_at: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
}, {
    sequelize: database_js_1.default,
    tableName: 'mitra_profiles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});
/**
 * Memastikan tabel mitra_profiles memiliki seluruh kolom yang dibutuhkan
 * secara idempotent tanpa menghapus atau merusak data yang sudah ada.
 */
const ensureMitraProfileSchema = async () => {
    await MitraProfile.sync();
    const requiredColumns = [
        { name: 'description', definition: 'TEXT NULL AFTER `started_year`' },
        { name: 'website', definition: 'VARCHAR(255) DEFAULT NULL AFTER `description`' },
        { name: 'instagram', definition: 'VARCHAR(100) DEFAULT NULL AFTER `website`' },
        { name: 'banner_url', definition: 'VARCHAR(500) DEFAULT NULL AFTER `instagram`' },
        { name: 'avatar_url', definition: 'VARCHAR(500) DEFAULT NULL AFTER `banner_url`' },
        { name: 'rejection_reason', definition: 'TEXT DEFAULT NULL AFTER `is_verified`' },
    ];
    const [existingCols] = await database_js_1.pool.query(`SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'mitra_profiles'`);
    const existingSet = new Set((existingCols || []).map((row) => String(row.COLUMN_NAME).toLowerCase()));
    for (const col of requiredColumns) {
        if (!existingSet.has(col.name.toLowerCase())) {
            await database_js_1.pool.query(`ALTER TABLE \`mitra_profiles\` ADD COLUMN \`${col.name}\` ${col.definition}`);
            console.log(`✅ Kolom mitra_profiles.${col.name} berhasil ditambahkan.`);
        }
    }
    // Sinkronisasi avatar_url mitra_profiles yang masih NULL dari users.avatar_url jika ada
    await database_js_1.pool.query(`UPDATE \`mitra_profiles\` m
     INNER JOIN \`users\` u ON m.user_id = u.id
     SET m.avatar_url = u.avatar_url
     WHERE m.avatar_url IS NULL AND u.avatar_url IS NOT NULL`);
    // Pastikan kolom profil tambahan (phone, birth_date, gender) di tabel users tersedia secara idempotent
    const [userCols] = await database_js_1.pool.query(`SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'`);
    const userColSet = new Set((userCols || []).map((row) => String(row.COLUMN_NAME).toLowerCase()));
    const requiredUserCols = [
        { name: 'phone', definition: 'VARCHAR(30) DEFAULT NULL AFTER `avatar_url`' },
        { name: 'birth_date', definition: 'VARCHAR(30) DEFAULT NULL AFTER `phone`' },
        { name: 'gender', definition: 'VARCHAR(20) DEFAULT NULL AFTER `birth_date`' },
    ];
    for (const col of requiredUserCols) {
        if (!userColSet.has(col.name)) {
            await database_js_1.pool.query(`ALTER TABLE \`users\` ADD COLUMN \`${col.name}\` ${col.definition}`);
            console.log(`✅ Kolom users.${col.name} berhasil ditambahkan.`);
        }
    }
    // Pastikan kolom tambahan di tabel reviews tersedia secara idempotent
    const [reviewCols] = await database_js_1.pool.query(`SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'reviews'`);
    const reviewColSet = new Set((reviewCols || []).map((row) => String(row.COLUMN_NAME).toLowerCase()));
    const requiredReviewCols = [
        { name: 'seller_reply', definition: 'TEXT DEFAULT NULL AFTER `comment`' },
        { name: 'variant', definition: 'VARCHAR(100) DEFAULT NULL AFTER `comment`' },
        { name: 'photo_urls', definition: 'JSON DEFAULT NULL AFTER `comment`' },
        { name: 'helpful_count', definition: 'INT DEFAULT 0 AFTER `comment`' },
    ];
    if (reviewCols && reviewCols.length > 0) {
        for (const col of requiredReviewCols) {
            if (!reviewColSet.has(col.name)) {
                await database_js_1.pool.query(`ALTER TABLE \`reviews\` ADD COLUMN \`${col.name}\` ${col.definition}`);
                console.log(`✅ Kolom reviews.${col.name} berhasil ditambahkan.`);
            }
        }
    }
    // Pastikan kolom description, icon_url, created_at di tabel categories tersedia secara idempotent
    const [catCols] = await database_js_1.pool.query(`SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'categories'`);
    const catColSet = new Set((catCols || []).map((row) => String(row.COLUMN_NAME).toLowerCase()));
    if (catCols && catCols.length > 0) {
        if (!catColSet.has('description')) {
            await database_js_1.pool.query(`ALTER TABLE \`categories\` ADD COLUMN \`description\` TEXT DEFAULT NULL AFTER \`name\``);
            console.log(`✅ Kolom categories.description berhasil ditambahkan.`);
        }
        if (!catColSet.has('icon_url')) {
            await database_js_1.pool.query(`ALTER TABLE \`categories\` ADD COLUMN \`icon_url\` VARCHAR(500) DEFAULT NULL`);
            console.log(`✅ Kolom categories.icon_url berhasil ditambahkan.`);
        }
        if (!catColSet.has('created_at')) {
            await database_js_1.pool.query(`ALTER TABLE \`categories\` ADD COLUMN \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP`);
            console.log(`✅ Kolom categories.created_at berhasil ditambahkan.`);
        }
    }
    // Pastikan kolom tambahan di tabel orders tersedia secara idempotent
    const [orderCols] = await database_js_1.pool.query(`SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'orders'`);
    const orderColSet = new Set((orderCols || []).map((row) => String(row.COLUMN_NAME).toLowerCase()));
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
                await database_js_1.pool.query(`ALTER TABLE \`orders\` ADD COLUMN \`${col.name}\` ${col.definition}`);
                console.log(`✅ Kolom orders.${col.name} berhasil ditambahkan.`);
            }
        }
    }
    // Pastikan kolom tambahan di tabel order_items tersedia secara idempotent
    const [oiCols] = await database_js_1.pool.query(`SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'order_items'`);
    const oiColSet = new Set((oiCols || []).map((row) => String(row.COLUMN_NAME).toLowerCase()));
    const requiredOiCols = [
        { name: 'price_at_purchase', definition: 'DECIMAL(12,2) DEFAULT 0.00' },
        { name: 'unit_price', definition: 'DECIMAL(12,2) DEFAULT 0.00' },
        { name: 'variant', definition: 'VARCHAR(100) DEFAULT NULL' },
    ];
    if (oiCols && oiCols.length > 0) {
        for (const col of requiredOiCols) {
            if (!oiColSet.has(col.name)) {
                await database_js_1.pool.query(`ALTER TABLE \`order_items\` ADD COLUMN \`${col.name}\` ${col.definition}`);
                console.log(`✅ Kolom order_items.${col.name} berhasil ditambahkan.`);
            }
        }
        await database_js_1.pool
            .query(`UPDATE \`order_items\`
         SET price_at_purchase = COALESCE(NULLIF(price_at_purchase, 0), unit_price, 0),
             unit_price = COALESCE(NULLIF(unit_price, 0), price_at_purchase, 0)`)
            .catch(() => { });
    }
    // Pastikan kolom tambahan di tabel transactions tersedia secara idempotent
    const [txCols] = await database_js_1.pool.query(`SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'transactions'`);
    const txColSet = new Set((txCols || []).map((row) => String(row.COLUMN_NAME).toLowerCase()));
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
                await database_js_1.pool.query(`ALTER TABLE \`transactions\` ADD COLUMN \`${col.name}\` ${col.definition}`);
                console.log(`✅ Kolom transactions.${col.name} berhasil ditambahkan.`);
            }
        }
    }
    // Pastikan kolom tambahan di tabel educational_tours tersedia secara idempotent
    const [tourCols] = await database_js_1.pool.query(`SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'educational_tours'`);
    const tourColSet = new Set((tourCols || []).map((row) => String(row.COLUMN_NAME).toLowerCase()));
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
                await database_js_1.pool.query(`ALTER TABLE \`educational_tours\` ADD COLUMN \`${col.name}\` ${col.definition}`);
                console.log(`✅ Kolom educational_tours.${col.name} berhasil ditambahkan.`);
            }
        }
    }
};
exports.ensureMitraProfileSchema = ensureMitraProfileSchema;
exports.default = MitraProfile;
//# sourceMappingURL=MitraProfile.js.map