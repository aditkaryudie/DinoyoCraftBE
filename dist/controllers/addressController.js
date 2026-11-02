"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setDefaultAddress = exports.deleteAddress = exports.updateAddress = exports.createAddress = exports.getAddresses = void 0;
const database_js_1 = __importDefault(require("../config/database.js"));
const getAddresses = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const [rows] = await database_js_1.default.query('SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC', [userId]);
        res.status(200).json({ success: true, data: rows });
    }
    catch (error) {
        console.error('Error getAddresses:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil daftar alamat' });
    }
};
exports.getAddresses = getAddresses;
const createAddress = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { recipient_name, phone, full_address, is_default } = req.body;
        if (!recipient_name || !phone || !full_address) {
            res.status(400).json({ success: false, message: 'Nama penerima, no HP, dan alamat lengkap wajib diisi' });
            return;
        }
        const isDefaultInt = is_default ? 1 : 0;
        if (isDefaultInt === 1) {
            await database_js_1.default.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
        }
        const [result] = await database_js_1.default.query(`INSERT INTO user_addresses (user_id, recipient_name, phone, full_address, is_default, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`, [userId, recipient_name.trim(), phone.trim(), full_address.trim(), isDefaultInt]);
        const [created] = await database_js_1.default.query('SELECT * FROM user_addresses WHERE id = ?', [result.insertId]);
        res.status(201).json({
            success: true,
            message: 'Alamat berhasil ditambahkan',
            data: created[0]
        });
    }
    catch (error) {
        console.error('Error createAddress:', error);
        res.status(500).json({ success: false, message: 'Gagal menambahkan alamat' });
    }
};
exports.createAddress = createAddress;
const updateAddress = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        const { id } = req.params;
        const { recipient_name, phone, full_address, is_default } = req.body;
        const [check] = await database_js_1.default.query('SELECT id FROM user_addresses WHERE id = ? AND user_id = ?', [id, userId]);
        if (!check || check.length === 0) {
            res.status(404).json({ success: false, message: 'Alamat tidak ditemukan' });
            return;
        }
        const isDefaultInt = is_default ? 1 : 0;
        if (isDefaultInt === 1) {
            await database_js_1.default.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
        }
        await database_js_1.default.query(`UPDATE user_addresses 
       SET recipient_name = COALESCE(?, recipient_name),
           phone = COALESCE(?, phone),
           full_address = COALESCE(?, full_address),
           is_default = COALESCE(?, is_default)
       WHERE id = ? AND user_id = ?`, [recipient_name ?? null, phone ?? null, full_address ?? null, is_default !== undefined ? isDefaultInt : null, id, userId]);
        const [updated] = await database_js_1.default.query('SELECT * FROM user_addresses WHERE id = ?', [id]);
        res.status(200).json({ success: true, message: 'Alamat berhasil diperbarui', data: updated[0] });
    }
    catch (error) {
        console.error('Error updateAddress:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui alamat' });
    }
};
exports.updateAddress = updateAddress;
const deleteAddress = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        const { id } = req.params;
        const [result] = await database_js_1.default.query('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [id, userId]);
        if (result.affectedRows === 0) {
            res.status(404).json({ success: false, message: 'Alamat tidak ditemukan' });
            return;
        }
        res.status(200).json({ success: true, message: 'Alamat berhasil dihapus' });
    }
    catch (error) {
        console.error('Error deleteAddress:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus alamat' });
    }
};
exports.deleteAddress = deleteAddress;
const setDefaultAddress = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        const { id } = req.params;
        await database_js_1.default.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [userId]);
        const [result] = await database_js_1.default.query('UPDATE user_addresses SET is_default = 1 WHERE id = ? AND user_id = ?', [id, userId]);
        if (result.affectedRows === 0) {
            res.status(404).json({ success: false, message: 'Alamat tidak ditemukan' });
            return;
        }
        res.status(200).json({ success: true, message: 'Alamat default berhasil disetel' });
    }
    catch (error) {
        console.error('Error setDefaultAddress:', error);
        res.status(500).json({ success: false, message: 'Gagal menyetel alamat default' });
    }
};
exports.setDefaultAddress = setDefaultAddress;
//# sourceMappingURL=addressController.js.map