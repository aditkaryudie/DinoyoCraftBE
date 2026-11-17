"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateHeartbeat = exports.markConversationAsRead = exports.getUnreadChatCount = exports.getChatContacts = exports.getChatHistory = exports.getMessages = exports.sendMessage = exports.touchUserActivity = void 0;
const database_js_1 = __importDefault(require("../config/database.js"));
const pusher_js_1 = __importDefault(require("../utils/pusher.js"));
const encryption_js_1 = require("../utils/encryption.js");
const notificationService_js_1 = require("../services/notificationService.js");
/**
 * Memperbarui timestamp aktivitas terakhir user di database (last_seen_at)
 */
const touchUserActivity = async (userId) => {
    if (!userId || isNaN(userId))
        return;
    try {
        await database_js_1.default.query('UPDATE users SET last_seen_at = NOW() WHERE id = ?', [userId]);
    }
    catch (err) {
        // Non-blocking log
    }
};
exports.touchUserActivity = touchUserActivity;
// Memory lock / cache untuk mencegah race condition double click atau simultaneous submit (< 3000ms)
const recentSubmissions = new Map();
/**
 * Mengirim pesan baru dan mentrigger event real-time ke Pusher
 * POST /api/chat/send/:targetUserId atau POST /api/chat/send
 */
const sendMessage = async (req, res) => {
    try {
        const senderId = req.user?.id || req.user?.userId || res.locals['userId'];
        const targetUserId = req.params['targetUserId'] ||
            req.body['targetUserId'] ||
            req.body['target_user_id'] ||
            req.body['receiver_id'];
        const rawMessage = req.body['message'];
        const messageText = typeof rawMessage === 'string' ? rawMessage.trim() : '';
        if (!senderId) {
            res.status(401).json({ success: false, message: 'Autentikasi gagal. User tidak ditemukan.' });
            return;
        }
        if (!targetUserId) {
            res.status(400).json({ success: false, message: 'targetUserId wajib diisi.' });
            return;
        }
        const numericSenderId = Number(senderId);
        const numericTargetId = Number(targetUserId);
        // Perbarui aktivitas pengirim
        await (0, exports.touchUserActivity)(numericSenderId);
        // Ekstrak file gambar dari multipart upload (req.file atau req.files) atau body image_url
        let imageUrl = null;
        const reqFiles = req.files;
        const reqFile = req.file;
        if (reqFile) {
            imageUrl = `/uploads/${reqFile.filename}`;
        }
        else if (Array.isArray(reqFiles) && reqFiles.length > 0) {
            const imgFile = reqFiles.find((f) => f.fieldname === 'image' ||
                f.fieldname === 'file' ||
                f.fieldname === 'attachment') || reqFiles[0];
            if (imgFile) {
                imageUrl = `/uploads/${imgFile.filename}`;
            }
        }
        else if (req.body['image_url'] &&
            typeof req.body['image_url'] === 'string' &&
            req.body['image_url'].trim()) {
            let rawImg = req.body['image_url'].trim();
            // Normalisasi jika path berupa stiker atau aset
            if (rawImg.includes('sticker')) {
                const parts = rawImg.split('/');
                const stickerFile = parts[parts.length - 1];
                imageUrl = `/uploads/stickers/${stickerFile}`;
            }
            else if (!rawImg.startsWith('/') && !rawImg.startsWith('http')) {
                imageUrl = `/${rawImg}`;
            }
            else {
                imageUrl = rawImg;
            }
        }
        if (!messageText && !imageUrl) {
            res.status(400).json({ success: false, message: 'Pesan atau gambar wajib dikirim.' });
            return;
        }
        // Memory lock untuk mencegah in-flight race condition atau double submit (< 3 detik untuk pesan identik)
        const dedupKey = `${numericSenderId}_${numericTargetId}_${messageText}_${imageUrl || ''}`;
        const nowMs = Date.now();
        const existing = recentSubmissions.get(dedupKey);
        if (existing && (nowMs - existing.time) < 3000) {
            console.log(`[Chat Backend] In-flight / double submit dicegah untuk sender ${numericSenderId}`);
            try {
                const data = existing.promise ? await existing.promise : existing.result;
                res.status(200).json({
                    success: true,
                    message: 'Pesan sudah terkirim.',
                    data,
                });
                return;
            }
            catch {
                // Fallback jika promise gagal
            }
        }
        let resolveSubmission = () => { };
        const submissionPromise = new Promise((resolve) => {
            resolveSubmission = resolve;
        });
        recentSubmissions.set(dedupKey, { time: nowMs, promise: submissionPromise });
        setTimeout(() => {
            recentSubmissions.delete(dedupKey);
        }, 5000);
        // Cegah double submit dari database dalam jeda waktu singkat (< 3 detik untuk pesan identik)
        const [recentMsgs] = await database_js_1.default.query(`SELECT id, sender_id, receiver_id, message, image_url, is_read, created_at 
       FROM messages 
       WHERE sender_id = ? AND receiver_id = ? 
       ORDER BY id DESC LIMIT 1`, [numericSenderId, numericTargetId]);
        if (recentMsgs && recentMsgs.length > 0) {
            const last = recentMsgs[0];
            const diffMs = Date.now() - new Date(last.created_at).getTime();
            const lastDecrypted = (0, encryption_js_1.decryptMessage)(last.message || '');
            const isSameMsg = lastDecrypted === messageText && (last.image_url || null) === (imageUrl || null);
            if (diffMs < 3000 && isSameMsg) {
                console.log(`[Chat Backend] Double submit dicegah untuk sender ${numericSenderId}`);
                const resultData = {
                    ...last,
                    message: messageText,
                    image_url: imageUrl,
                };
                resolveSubmission(resultData);
                recentSubmissions.set(dedupKey, { time: nowMs, result: resultData });
                res.status(200).json({
                    success: true,
                    message: 'Pesan sudah terkirim.',
                    data: resultData,
                });
                return;
            }
        }
        // 1. Enkripsi pesan sebelum masuk ke database
        const encryptedText = (0, encryption_js_1.encryptMessage)(messageText);
        // Simpan ke database (MySQL)
        const [result] = await database_js_1.default.query('INSERT INTO messages (sender_id, receiver_id, message, image_url, is_read) VALUES (?, ?, ?, ?, 0)', [numericSenderId, numericTargetId, encryptedText, imageUrl]);
        const insertId = result.insertId;
        const [rows] = await database_js_1.default.query('SELECT id, sender_id, receiver_id, message, image_url, is_read, created_at FROM messages WHERE id = ?', [insertId]);
        const newMessage = rows[0] || {
            id: insertId,
            sender_id: numericSenderId,
            receiver_id: numericTargetId,
            message: encryptedText,
            image_url: imageUrl,
            created_at: new Date(),
        };
        // 2. Trigger Pusher agar frontend langsung menerima pesan secara real-time
        const [senderRows] = await database_js_1.default.query(`SELECT u.name, mp.store_name, COALESCE(NULLIF(TRIM(mp.store_name), ''), u.name) AS display_name
       FROM users u
       LEFT JOIN mitra_profiles mp ON mp.user_id = u.id
       WHERE u.id = ? LIMIT 1`, [numericSenderId]);
        const senderName = senderRows?.[0]?.display_name || senderRows?.[0]?.name || 'Seseorang';
        const channelName = `chat-${Math.min(numericSenderId, numericTargetId)}-${Math.max(numericSenderId, numericTargetId)}`;
        const userTargetChannel = `user-${numericTargetId}`;
        const userSenderChannel = `user-${numericSenderId}`;
        console.log(`[Pusher Backend] Triggering event 'new-message' on channels:`, [
            channelName,
            userTargetChannel,
            userSenderChannel,
        ]);
        const msgType = (imageUrl && imageUrl.includes('sticker')) ? 'sticker' : (imageUrl ? 'image' : 'text');
        try {
            await pusher_js_1.default.trigger([channelName, userTargetChannel, userSenderChannel], 'new-message', {
                id: Number(newMessage.id),
                sender_id: numericSenderId,
                receiver_id: numericTargetId,
                sender_name: senderName,
                store_name: senderRows?.[0]?.store_name || senderName,
                message: messageText, // Kirim teks asli ke Pusher
                image_url: imageUrl,
                type: msgType,
                created_at: newMessage.created_at,
            });
            console.log(`[Pusher Backend] Event 'new-message' berhasil dikirim ke Pusher`);
        }
        catch (pusherError) {
            console.error('⚠️ Pusher trigger error:', pusherError);
        }
        // Trigger FCM Push Notification ke penerima chat
        try {
            (0, notificationService_js_1.sendPushNotificationToUser)(numericTargetId, `Pesan Baru dari ${senderName}`, messageText || '📷 [Foto]', {
                type: 'chat',
                route: `/chat-room?store=${encodeURIComponent(senderName)}&userId=${numericSenderId}`,
                sender_id: String(numericSenderId),
                store_name: senderName,
                image_url: imageUrl || '',
            }).catch((err) => console.warn('[FCM] Push notification error:', err));
        }
        catch (fcmErr) {
            console.warn('⚠️ Gagal trigger push notification chat:', fcmErr);
        }
        const responseData = {
            ...newMessage,
            message: messageText, // Kirim teks asli di response
            image_url: imageUrl,
        };
        resolveSubmission(responseData);
        recentSubmissions.set(dedupKey, { time: nowMs, result: responseData });
        res.status(201).json({
            success: true,
            message: 'Pesan terkirim!',
            data: responseData,
        });
    }
    catch (error) {
        console.error('❌ Error saat sendMessage:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengirim pesan.',
            error: error.message,
        });
    }
};
exports.sendMessage = sendMessage;
/**
 * Mengambil riwayat pesan antara pengguna yang sedang login dan target user
 * GET /api/chat/messages/:targetUserId
 */
const getMessages = async (req, res) => {
    try {
        const currentUserId = req.user?.id || req.user?.userId || res.locals['userId'];
        const { targetUserId } = req.params;
        if (!currentUserId) {
            res.status(401).json({ success: false, message: 'Autentikasi gagal.' });
            return;
        }
        const numericCurrentId = Number(currentUserId);
        const numericTargetId = Number(targetUserId);
        // Perbarui aktivitas user aktif
        await (0, exports.touchUserActivity)(numericCurrentId);
        // Ambil info status lawan bicara (online bila aktif dalam 2 menit terakhir)
        const [targetRows] = await database_js_1.default.query(`SELECT u.id, u.name, u.role, u.last_seen_at,
              (u.last_seen_at IS NOT NULL AND u.last_seen_at >= NOW() - INTERVAL 2 MINUTE) AS is_online,
              mp.store_name
       FROM users u
       LEFT JOIN mitra_profiles mp ON mp.user_id = u.id
       WHERE u.id = ? LIMIT 1`, [numericTargetId]);
        const targetUser = targetRows?.[0] || null;
        const targetIsOnline = targetUser
            ? Boolean(targetUser.is_online ||
                (targetUser.last_seen_at && (Date.now() - new Date(targetUser.last_seen_at).getTime() <= 2 * 60 * 1000)))
            : false;
        const [messages] = await database_js_1.default.query(`SELECT id, sender_id, receiver_id, message, image_url, is_read, created_at
       FROM messages
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
       ORDER BY created_at ASC`, [numericCurrentId, numericTargetId, numericTargetId, numericCurrentId]);
        // Dekripsi pesan sebelum dikirim ke frontend
        const decryptedMessages = messages.map((msg) => {
            let imgUrl = msg.image_url || null;
            if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('assets/stickers/')) {
                imgUrl = `/uploads/stickers/${imgUrl.replace('assets/stickers/', '')}`;
            }
            const msgType = (imgUrl && imgUrl.includes('sticker')) ? 'sticker' : (imgUrl ? 'image' : 'text');
            return {
                ...msg,
                message: (0, encryption_js_1.decryptMessage)(msg.message || ''),
                image_url: imgUrl,
                type: msgType,
            };
        });
        // Tandai pesan dari targetUserId yang masuk ke currentUserId sebagai sudah dibaca
        await database_js_1.default.query('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0', [numericTargetId, numericCurrentId]);
        res.status(200).json({
            success: true,
            current_user_id: numericCurrentId,
            target_user: targetUser ? {
                id: targetUser.id,
                name: targetUser.store_name || targetUser.name,
                role: targetUser.role,
                is_online: targetIsOnline,
                last_seen_at: targetUser.last_seen_at || null,
            } : null,
            is_online: targetIsOnline,
            last_seen_at: targetUser?.last_seen_at || null,
            data: decryptedMessages,
        });
    }
    catch (error) {
        console.error('❌ Error saat getMessages:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil riwayat pesan.',
            error: error.message,
        });
    }
};
exports.getMessages = getMessages;
// Alias getChatHistory untuk kemudahan dan kompatibilitas
exports.getChatHistory = exports.getMessages;
/**
 * Mengambil daftar kontak percakapan yang tersedia untuk user yang sedang login
 * GET /api/chat/contacts
 */
const getChatContacts = async (req, res) => {
    try {
        const currentUserId = req.user?.id || req.user?.userId || res.locals['userId'];
        if (!currentUserId) {
            res.status(401).json({ success: false, message: 'Autentikasi gagal.' });
            return;
        }
        const numericCurrentId = Number(currentUserId);
        await (0, exports.touchUserActivity)(numericCurrentId);
        const [contacts] = await database_js_1.default.query(`SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role, 
        u.last_seen_at,
        (u.last_seen_at IS NOT NULL AND u.last_seen_at >= NOW() - INTERVAL 2 MINUTE) AS is_online,
        CASE
          WHEN mp.id IS NOT NULL OR u.role = 'mitra' THEN
            CASE
              WHEN mp.avatar_url IS NOT NULL AND mp.avatar_url != '' AND mp.avatar_url NOT LIKE '%googleusercontent.com%' AND mp.avatar_url NOT LIKE '%google.com%' THEN mp.avatar_url
              WHEN u.avatar_url IS NOT NULL AND u.avatar_url != '' AND u.avatar_url NOT LIKE '%googleusercontent.com%' AND u.avatar_url NOT LIKE '%google.com%' THEN u.avatar_url
              ELSE NULL
            END
          ELSE u.avatar_url
        END AS avatar_url,
        mp.store_name,
        (
          SELECT m.message FROM messages m 
          WHERE (m.sender_id = u.id AND m.receiver_id = ?) 
             OR (m.sender_id = ? AND m.receiver_id = u.id)
          ORDER BY m.created_at DESC LIMIT 1
        ) AS last_message,
        (
          SELECT m.image_url FROM messages m 
          WHERE (m.sender_id = u.id AND m.receiver_id = ?) 
             OR (m.sender_id = ? AND m.receiver_id = u.id)
          ORDER BY m.created_at DESC LIMIT 1
        ) AS last_image_url,
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
      ORDER BY (last_message_time IS NOT NULL) DESC, last_message_time DESC, u.name ASC`, [
            numericCurrentId,
            numericCurrentId,
            numericCurrentId,
            numericCurrentId,
            numericCurrentId,
            numericCurrentId,
            numericCurrentId,
            numericCurrentId,
        ]);
        // Dekripsi preview pesan terakhir untuk setiap kontak
        const decryptedContacts = contacts.map((contact) => {
            const lastImg = contact.last_image_url || '';
            const lastIsSticker = Boolean(lastImg && (lastImg.includes('sticker') || lastImg.includes('/stickers/')));
            let preview = contact.last_message ? (0, encryption_js_1.decryptMessage)(contact.last_message) : '';
            if (!preview && lastImg) {
                preview = lastIsSticker ? '🏷️ Stiker' : '📷 [Foto]';
            }
            const isOnline = Boolean(contact.is_online ||
                (contact.last_seen_at && (Date.now() - new Date(contact.last_seen_at).getTime() <= 2 * 60 * 1000)));
            return {
                ...contact,
                is_online: isOnline,
                last_seen_at: contact.last_seen_at || null,
                last_message: preview || contact.last_message || null,
                last_image_url: contact.last_image_url || null,
            };
        });
        res.status(200).json({
            success: true,
            current_user_id: numericCurrentId,
            data: decryptedContacts
        });
    }
    catch (error) {
        console.error('❌ Error saat getChatContacts:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil daftar kontak chat.',
            error: error.message
        });
    }
};
exports.getChatContacts = getChatContacts;
/**
 * Mengambil total jumlah pesan belum dibaca untuk user yang sedang login.
 * GET /api/chat/unread-count
 */
const getUnreadChatCount = async (req, res) => {
    try {
        const currentUserId = req.user?.id || req.user?.userId || res.locals['userId'];
        if (!currentUserId) {
            res.status(401).json({ success: false, message: 'Autentikasi gagal.' });
            return;
        }
        const numericCurrentId = Number(currentUserId);
        const [rows] = await database_js_1.default.query('SELECT COUNT(*) AS unread_count FROM messages WHERE receiver_id = ? AND is_read = 0', [numericCurrentId]);
        const [senderRows] = await database_js_1.default.query(`SELECT m.sender_id, COALESCE(NULLIF(TRIM(mp.store_name), ''), u.name) AS store_name, COUNT(*) AS unread_count
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       LEFT JOIN mitra_profiles mp ON mp.user_id = u.id
       WHERE m.receiver_id = ? AND m.is_read = 0
       GROUP BY m.sender_id, store_name`, [numericCurrentId]);
        res.status(200).json({
            success: true,
            data: {
                unread_count: Number(rows?.[0]?.unread_count || 0),
                unread_senders: senderRows || [],
            },
        });
    }
    catch (error) {
        console.error('❌ Error saat getUnreadChatCount:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil jumlah pesan belum dibaca.',
            error: error.message,
        });
    }
};
exports.getUnreadChatCount = getUnreadChatCount;
/**
 * Menandai pesan dari targetUserId kepada user login sebagai sudah dibaca.
 * PATCH /api/chat/messages/:targetUserId/read
 */
const markConversationAsRead = async (req, res) => {
    try {
        const currentUserId = req.user?.id || req.user?.userId || res.locals['userId'];
        const { targetUserId } = req.params;
        if (!currentUserId) {
            res.status(401).json({ success: false, message: 'Autentikasi gagal.' });
            return;
        }
        const numericCurrentId = Number(currentUserId);
        const numericTargetId = Number(targetUserId);
        await (0, exports.touchUserActivity)(numericCurrentId);
        const [result] = await database_js_1.default.query('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0', [numericTargetId, numericCurrentId]);
        const [countRows] = await database_js_1.default.query('SELECT COUNT(*) AS unread_count FROM messages WHERE receiver_id = ? AND is_read = 0', [numericCurrentId]);
        res.status(200).json({
            success: true,
            data: {
                marked_count: Number(result?.affectedRows || 0),
                unread_count: Number(countRows?.[0]?.unread_count || 0),
            },
        });
    }
    catch (error) {
        console.error('❌ Error saat markConversationAsRead:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal menandai pesan sudah dibaca.',
            error: error.message,
        });
    }
};
exports.markConversationAsRead = markConversationAsRead;
/**
 * Menerima heartbeat dari klien untuk memperbarui last_seen_at secara periodik
 * POST /api/chat/heartbeat
 */
const updateHeartbeat = async (req, res) => {
    try {
        const currentUserId = req.user?.id || req.user?.userId || res.locals['userId'];
        if (!currentUserId) {
            res.status(401).json({ success: false, message: 'Autentikasi gagal.' });
            return;
        }
        const numericCurrentId = Number(currentUserId);
        await (0, exports.touchUserActivity)(numericCurrentId);
        res.status(200).json({
            success: true,
            message: 'Heartbeat tercatat.',
            is_online: true,
            last_seen_at: new Date().toISOString(),
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Gagal memperbarui heartbeat.',
            error: error.message,
        });
    }
};
exports.updateHeartbeat = updateHeartbeat;
//# sourceMappingURL=chatController.js.map