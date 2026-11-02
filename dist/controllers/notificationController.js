"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllNotificationsRead = exports.markNotificationRead = exports.getNotifications = void 0;
const database_js_1 = __importDefault(require("../config/database.js"));
const getNotifications = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const [rows] = await database_js_1.default.query(`SELECT id, user_id, title, body, type, data, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`, [userId]).catch(() => [[]]);
        const unreadCount = rows.filter((r) => !r.is_read).length;
        res.status(200).json({
            success: true,
            data: {
                unread_count: unreadCount,
                notifications: rows
            }
        });
    }
    catch (error) {
        console.error('Error getNotifications:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil notifikasi' });
    }
};
exports.getNotifications = getNotifications;
const markNotificationRead = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        const { id } = req.params;
        await database_js_1.default.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
        res.status(200).json({ success: true, message: 'Notifikasi ditandai telah dibaca' });
    }
    catch (error) {
        console.error('Error markNotificationRead:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui notifikasi' });
    }
};
exports.markNotificationRead = markNotificationRead;
const markAllNotificationsRead = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        await database_js_1.default.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
        res.status(200).json({ success: true, message: 'Semua notifikasi ditandai telah dibaca' });
    }
    catch (error) {
        console.error('Error markAllNotificationsRead:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui notifikasi' });
    }
};
exports.markAllNotificationsRead = markAllNotificationsRead;
//# sourceMappingURL=notificationController.js.map