"use strict";
// ============================================================
//  src/controllers/notificationController.ts
//  Controller Pusat Notifikasi Pengguna & Mitra
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNotification = exports.markAllAsRead = exports.markAsRead = exports.getUserNotifications = void 0;
const database_js_1 = __importDefault(require("../config/database.js"));
const response_js_1 = require("../utils/response.js");
const getUserNotifications = async (_req, res) => {
    try {
        const userId = res.locals['userId'];
        const [rows] = await database_js_1.default.query(`SELECT id, title, message, type, reference_id, is_read, created_at 
       FROM notifications 
       WHERE user_id = ? 
       ORDER BY id DESC LIMIT 50`, [userId]);
        const [unreadRows] = await database_js_1.default.query('SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);
        (0, response_js_1.sendSuccess)(res, {
            unread_count: unreadRows[0]?.unread_count || 0,
            notifications: rows,
        }, 'Daftar notifikasi berhasil diambil.');
    }
    catch (error) {
        console.error('❌ [getUserNotifications] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal mengambil notifikasi.');
    }
};
exports.getUserNotifications = getUserNotifications;
const markAsRead = async (req, res) => {
    try {
        const userId = res.locals['userId'];
        const { id } = req.params;
        const [result] = await database_js_1.default.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
        if (result.affectedRows === 0) {
            (0, response_js_1.sendNotFound)(res, 'Notifikasi tidak ditemukan.');
            return;
        }
        (0, response_js_1.sendSuccess)(res, null, 'Notifikasi ditandai sudah dibaca.');
    }
    catch (error) {
        console.error('❌ [markAsRead] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal memperbarui status notifikasi.');
    }
};
exports.markAsRead = markAsRead;
const markAllAsRead = async (_req, res) => {
    try {
        const userId = res.locals['userId'];
        await database_js_1.default.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
        (0, response_js_1.sendSuccess)(res, null, 'Semua notifikasi ditandai sudah dibaca.');
    }
    catch (error) {
        console.error('❌ [markAllAsRead] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal memperbarui notifikasi.');
    }
};
exports.markAllAsRead = markAllAsRead;
const deleteNotification = async (req, res) => {
    try {
        const userId = res.locals['userId'];
        const { id } = req.params;
        const [result] = await database_js_1.default.query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, userId]);
        if (result.affectedRows === 0) {
            (0, response_js_1.sendNotFound)(res, 'Notifikasi tidak ditemukan.');
            return;
        }
        (0, response_js_1.sendSuccess)(res, null, 'Notifikasi berhasil dihapus.');
    }
    catch (error) {
        console.error('❌ [deleteNotification] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal menghapus notifikasi.');
    }
};
exports.deleteNotification = deleteNotification;
//# sourceMappingURL=notificationController.js.map