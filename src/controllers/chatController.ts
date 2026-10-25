import { Request, Response } from 'express';
import Pusher from 'pusher';
import pool from '../config/database.js';

// Inisialisasi Pusher Server SDK
const pusher = new Pusher({
  appId: (process.env.PUSHER_APP_ID || '').trim(),
  key: (process.env.PUSHER_KEY || '').trim(),
  secret: (process.env.PUSHER_SECRET || '').trim(),
  cluster: (process.env.PUSHER_CLUSTER || 'ap1').trim(),
  useTLS: true
});

/**
 * Mengirim pesan baru dan mentrigger event real-time ke Pusher
 * POST /api/chat/send/:targetUserId
 */
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const senderId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    const { targetUserId } = req.params;
    const { message } = req.body;

    if (!senderId) {
      res.status(401).json({ success: false, message: 'Autentikasi gagal. User tidak ditemukan.' });
      return;
    }

    if (!targetUserId || !message || !message.trim()) {
      res.status(400).json({ success: false, message: 'targetUserId dan message wajib diisi.' });
      return;
    }

    const numericSenderId = Number(senderId);
    const numericTargetId = Number(targetUserId);

    // 1. Simpan pesan ke database (MySQL)
    const [result]: any = await pool.query(
      'INSERT INTO messages (sender_id, receiver_id, message, is_read) VALUES (?, ?, ?, 0)',
      [numericSenderId, numericTargetId, message.trim()]
    );

    const insertId = result.insertId;
    const [rows]: any = await pool.query(
      'SELECT id, sender_id, receiver_id, message, is_read, created_at FROM messages WHERE id = ?',
      [insertId]
    );

    const newMessage = rows[0] || {
      id: insertId,
      sender_id: numericSenderId,
      receiver_id: numericTargetId,
      message: message.trim(),
      created_at: new Date()
    };

    // 2. Trigger Pusher agar frontend langsung menerima pesan secara real-time
    // Nama channel dibuat unik berdasarkan percakapan antara dua user dan channel user
    const channelName = `chat-${Math.min(numericSenderId, numericTargetId)}-${Math.max(numericSenderId, numericTargetId)}`;
    const userTargetChannel = `user-${numericTargetId}`;
    const userSenderChannel = `user-${numericSenderId}`;

    console.log(`[Pusher Backend] Triggering event 'new-message' on channels:`, [channelName, userTargetChannel, userSenderChannel]);

    try {
      await pusher.trigger([channelName, userTargetChannel, userSenderChannel], 'new-message', {
        id: Number(newMessage.id),
        sender_id: numericSenderId,
        receiver_id: numericTargetId,
        message: message.trim(),
        created_at: newMessage.created_at
      });
      console.log(`[Pusher Backend] Event 'new-message' berhasil dikirim ke Pusher`);
    } catch (pusherError) {
      console.error('⚠️ Pusher trigger error:', pusherError);
    }

    res.status(201).json({
      success: true,
      message: 'Pesan terkirim!',
      data: newMessage
    });
  } catch (error: any) {
    console.error('❌ Error saat sendMessage:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengirim pesan.',
      error: error.message
    });
  }
};

/**
 * Mengambil riwayat pesan antara pengguna yang sedang login dan target user
 * GET /api/chat/messages/:targetUserId
 */
export const getMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUserId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];
    const { targetUserId } = req.params;

    if (!currentUserId) {
      res.status(401).json({ success: false, message: 'Autentikasi gagal.' });
      return;
    }

    const numericCurrentId = Number(currentUserId);
    const numericTargetId = Number(targetUserId);

    const [messages]: any = await pool.query(
      `SELECT id, sender_id, receiver_id, message, is_read, created_at
       FROM messages
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
       ORDER BY created_at ASC`,
      [numericCurrentId, numericTargetId, numericTargetId, numericCurrentId]
    );

    // Tandai pesan dari targetUserId yang masuk ke currentUserId sebagai sudah dibaca
    await pool.query(
      'UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0',
      [numericTargetId, numericCurrentId]
    );

    res.status(200).json({
      success: true,
      current_user_id: numericCurrentId,
      data: messages
    });
  } catch (error: any) {
    console.error('❌ Error saat getMessages:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil riwayat pesan.',
      error: error.message
    });
  }
};

/**
 * Mengambil daftar kontak percakapan yang tersedia untuk user yang sedang login
 * GET /api/chat/contacts
 */
export const getChatContacts = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUserId = (req as any).user?.id || (req as any).user?.userId || res.locals['userId'];

    if (!currentUserId) {
      res.status(401).json({ success: false, message: 'Autentikasi gagal.' });
      return;
    }

    const numericCurrentId = Number(currentUserId);

    const [contacts]: any = await pool.query(
      `SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role, 
        u.avatar_url,
        mp.store_name,
        (
          SELECT m.message FROM messages m 
          WHERE (m.sender_id = u.id AND m.receiver_id = ?) 
             OR (m.sender_id = ? AND m.receiver_id = u.id)
          ORDER BY m.created_at DESC LIMIT 1
        ) AS last_message,
        (
          SELECT m.created_at FROM messages m 
          WHERE (m.sender_id = u.id AND m.receiver_id = ?) 
             OR (m.sender_id = ? AND m.receiver_id = u.id)
          ORDER BY m.created_at DESC LIMIT 1
        ) AS last_message_time,
        (
          SELECT COUNT(*) FROM messages m 
          WHERE m.sender_id = u.id AND m.receiver_id = ? AND m.is_read = 0
        ) AS unread_count
      FROM users u
      LEFT JOIN mitra_profiles mp ON u.id = mp.user_id
      WHERE u.id != ? AND u.is_active = 1
      ORDER BY (last_message_time IS NOT NULL) DESC, last_message_time DESC, u.name ASC`,
      [numericCurrentId, numericCurrentId, numericCurrentId, numericCurrentId, numericCurrentId, numericCurrentId]
    );

    res.status(200).json({
      success: true,
      current_user_id: numericCurrentId,
      data: contacts
    });
  } catch (error: any) {
    console.error('❌ Error saat getChatContacts:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar kontak chat.',
      error: error.message
    });
  }
};
