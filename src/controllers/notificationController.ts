// ============================================================
//  src/controllers/notificationController.ts
//  Controller Pusat Notifikasi Pengguna & Mitra
// ============================================================

import { Request, Response } from 'express';
import pool from '../config/database.js';
import { sendSuccess, sendNotFound, sendError } from '../utils/response.js';

export const getUserNotifications = async (_req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals['userId'];

    const [rows]: any = await pool.query(
      `SELECT id, title, message, type, reference_id, is_read, created_at 
       FROM notifications 
       WHERE user_id = ? 
       ORDER BY id DESC LIMIT 50`,
      [userId]
    );

    const [unreadRows]: any = await pool.query(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    sendSuccess(
      res,
      {
        unread_count: unreadRows[0]?.unread_count || 0,
        notifications: rows,
      },
      'Daftar notifikasi berhasil diambil.'
    );
  } catch (error) {
    console.error('❌ [getUserNotifications] Error:', error);
    sendError(res, 'Gagal mengambil notifikasi.');
  }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals['userId'];
    const { id } = req.params;

    const [result]: any = await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (result.affectedRows === 0) {
      sendNotFound(res, 'Notifikasi tidak ditemukan.');
      return;
    }

    sendSuccess(res, null, 'Notifikasi ditandai sudah dibaca.');
  } catch (error) {
    console.error('❌ [markAsRead] Error:', error);
    sendError(res, 'Gagal memperbarui status notifikasi.');
  }
};

export const markAllAsRead = async (_req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals['userId'];
    await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
    sendSuccess(res, null, 'Semua notifikasi ditandai sudah dibaca.');
  } catch (error) {
    console.error('❌ [markAllAsRead] Error:', error);
    sendError(res, 'Gagal memperbarui notifikasi.');
  }
};

export const deleteNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = res.locals['userId'];
    const { id } = req.params;

    const [result]: any = await pool.query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (result.affectedRows === 0) {
      sendNotFound(res, 'Notifikasi tidak ditemukan.');
      return;
    }

    sendSuccess(res, null, 'Notifikasi berhasil dihapus.');
  } catch (error) {
    console.error('❌ [deleteNotification] Error:', error);
    sendError(res, 'Gagal menghapus notifikasi.');
  }
};
