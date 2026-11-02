import { Request, Response } from 'express';
import pool from '../config/database.js';

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const [rows]: any = await pool.query(
      `SELECT id, user_id, title, body, type, data, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    ).catch(() => [[]]);

    const unreadCount = rows.filter((r: any) => !r.is_read).length;

    res.status(200).json({
      success: true,
      data: {
        unread_count: unreadCount,
        notifications: rows
      }
    });
  } catch (error) {
    console.error('Error getNotifications:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil notifikasi' });
  }
};

export const markNotificationRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    const { id } = req.params;

    await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
    res.status(200).json({ success: true, message: 'Notifikasi ditandai telah dibaca' });
  } catch (error) {
    console.error('Error markNotificationRead:', error);
    res.status(500).json({ success: false, message: 'Gagal memperbarui notifikasi' });
  }
};

export const markAllNotificationsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];

    await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
    res.status(200).json({ success: true, message: 'Semua notifikasi ditandai telah dibaca' });
  } catch (error) {
    console.error('Error markAllNotificationsRead:', error);
    res.status(500).json({ success: false, message: 'Gagal memperbarui notifikasi' });
  }
};

