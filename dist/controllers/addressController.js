"use strict";
// ============================================================
//  src/controllers/addressController.ts
//  Controller Buku Alamat Pengiriman Pengguna
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setDefaultAddress = exports.deleteAddress = exports.updateAddress = exports.createAddress = exports.getAddressById = exports.getUserAddresses = void 0;
const database_js_1 = __importDefault(require("../config/database.js"));
const response_js_1 = require("../utils/response.js");
const getUserAddresses = async (_req, res) => {
    try {
        const userId = res.locals['userId'];
        const [rows] = await database_js_1.default.query(`SELECT id, recipient_name, phone, full_address, city, postal_code, label, is_default, created_at 
       FROM user_addresses 
       WHERE user_id = ? 
       ORDER BY is_default DESC, id DESC`, [userId]);
        (0, response_js_1.sendSuccess)(res, rows, 'Daftar alamat berhasil diambil.');
    }
    catch (error) {
        console.error('❌ [getUserAddresses] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal mengambil daftar alamat.');
    }
};
exports.getUserAddresses = getUserAddresses;
const getAddressById = async (req, res) => {
    try {
        const userId = res.locals['userId'];
        const { id } = req.params;
        const [rows] = await database_js_1.default.query(`SELECT id, recipient_name, phone, full_address, city, postal_code, label, is_default, created_at 
       FROM user_addresses 
       WHERE id = ? AND user_id = ?`, [id, userId]);
        if (rows.length === 0) {
            (0, response_js_1.sendNotFound)(res, 'Alamat tidak ditemukan.');
            return;
        }
        (0, response_js_1.sendSuccess)(res, rows[0], 'Detail alamat berhasil diambil.');
    }
    catch (error) {
        console.error('❌ [getAddressById] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal mengambil detail alamat.');
    }
};
exports.getAddressById = getAddressById;
const createAddress = async (req, res) => {
    const connection = await database_js_1.default.getConnection();
    try {
        await connection.beginTransaction();
        const userId = res.locals['userId'];
        const { recipient_name, phone, full_address, city, postal_code, label = 'Rumah', is_default = false } = req.body;
        // Jika diset sebagai default atau ini alamat pertama, jadikan default
        const [countRows] = await connection.query('SELECT COUNT(*) as total FROM user_addresses WHERE user_id = ?', [userId]);
        const isFirstAddress = countRows[0]?.total === 0;
        const shouldBeDefault = is_default || isFirstAddress;
        if (shouldBeDefault) {
            await connection.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
        }
        const [result] = await connection.query(`INSERT INTO user_addresses (user_id, recipient_name, phone, full_address, city, postal_code, label, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [userId, recipient_name, phone, full_address, city || null, postal_code || null, label, shouldBeDefault ? 1 : 0]);
        await connection.commit();
        const [newAddress] = await database_js_1.default.query('SELECT * FROM user_addresses WHERE id = ?', [result.insertId]);
        (0, response_js_1.sendCreated)(res, newAddress[0], 'Alamat berhasil ditambahkan.');
    }
    catch (error) {
        await connection.rollback();
        console.error('❌ [createAddress] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal menambahkan alamat.');
    }
    finally {
        connection.release();
    }
};
exports.createAddress = createAddress;
const updateAddress = async (req, res) => {
    const connection = await database_js_1.default.getConnection();
    try {
        await connection.beginTransaction();
        const userId = res.locals['userId'];
        const { id } = req.params;
        const { recipient_name, phone, full_address, city, postal_code, label, is_default } = req.body;
        const [existing] = await connection.query('SELECT id FROM user_addresses WHERE id = ? AND user_id = ?', [id, userId]);
        if (existing.length === 0) {
            await connection.rollback();
            (0, response_js_1.sendNotFound)(res, 'Alamat tidak ditemukan.');
            return;
        }
        if (is_default) {
            await connection.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
        }
        await connection.query(`UPDATE user_addresses SET 
         recipient_name = COALESCE(?, recipient_name),
         phone = COALESCE(?, phone),
         full_address = COALESCE(?, full_address),
         city = COALESCE(?, city),
         postal_code = COALESCE(?, postal_code),
         label = COALESCE(?, label),
         is_default = COALESCE(?, is_default)
       WHERE id = ? AND user_id = ?`, [recipient_name, phone, full_address, city, postal_code, label, is_default !== undefined ? (is_default ? 1 : 0) : null, id, userId]);
        await connection.commit();
        const [updated] = await database_js_1.default.query('SELECT * FROM user_addresses WHERE id = ?', [id]);
        (0, response_js_1.sendSuccess)(res, updated[0], 'Alamat berhasil diperbarui.');
    }
    catch (error) {
        await connection.rollback();
        console.error('❌ [updateAddress] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal memperbarui alamat.');
    }
    finally {
        connection.release();
    }
};
exports.updateAddress = updateAddress;
const deleteAddress = async (req, res) => {
    try {
        const userId = res.locals['userId'];
        const { id } = req.params;
        const [result] = await database_js_1.default.query('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [id, userId]);
        if (result.affectedRows === 0) {
            (0, response_js_1.sendNotFound)(res, 'Alamat tidak ditemukan.');
            return;
        }
        (0, response_js_1.sendSuccess)(res, null, 'Alamat berhasil dihapus.');
    }
    catch (error) {
        console.error('❌ [deleteAddress] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal menghapus alamat.');
    }
};
exports.deleteAddress = deleteAddress;
const setDefaultAddress = async (req, res) => {
    const connection = await database_js_1.default.getConnection();
    try {
        await connection.beginTransaction();
        const userId = res.locals['userId'];
        const { id } = req.params;
        const [check] = await connection.query('SELECT id FROM user_addresses WHERE id = ? AND user_id = ?', [id, userId]);
        if (check.length === 0) {
            await connection.rollback();
            (0, response_js_1.sendNotFound)(res, 'Alamat tidak ditemukan.');
            return;
        }
        await connection.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
        await connection.query('UPDATE user_addresses SET is_default = 1 WHERE id = ? AND user_id = ?', [id, userId]);
        await connection.commit();
        (0, response_js_1.sendSuccess)(res, null, 'Alamat utama berhasil diubah.');
    }
    catch (error) {
        await connection.rollback();
        console.error('❌ [setDefaultAddress] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal mengubah alamat default.');
    }
    finally {
        connection.release();
    }
};
exports.setDefaultAddress = setDefaultAddress;
//# sourceMappingURL=addressController.js.map