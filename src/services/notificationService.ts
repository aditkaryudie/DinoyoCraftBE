import { getMessaging } from 'firebase-admin/messaging';
import { isFirebaseInitialized } from '../config/firebase.js';
import pool from '../config/database.js';

export const sendPushNotificationToUser = async (
  userId: number,
  title: string,
  body: string,
  dataPayload: Record<string, string> = {}
): Promise<void> => {
  try {
    if (!isFirebaseInitialized) {
      console.log(`[FCM-MOCK] Firebase belum diinisialisasi. Simulasi Push Notif ke User ${userId}: [${title}] ${body}`);
      return;
    }

    // 1. Ambil seluruh device token milik user
    const [rows]: any = await pool.query(
      'SELECT fcm_token FROM user_device_tokens WHERE user_id = ?',
      [userId]
    );

    if (!rows || rows.length === 0) return;

    const tokens: string[] = rows.map((r: any) => r.fcm_token).filter(Boolean);
    if (tokens.length === 0) return;

    // Pastikan data payload seluruhnya string dan memuat title/body untuk handler Android/Flutter
    const normalizedData: Record<string, string> = {
      title,
      body,
      ...Object.fromEntries(
        Object.entries(dataPayload).map(([k, v]) => [k, String(v ?? '')])
      ),
    };

    // 2. Kirim multicast pesan FCM dengan channel high-importance Android
    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: normalizedData,
      android: {
        priority: 'high',
        notification: {
          channelId: 'dinoyocraft_channel',
          sound: 'default',
          defaultSound: true,
          visibility: 'public',
        },
      },
    });

    // Bersihkan token yang sudah kedaluwarsa / tidak terdaftar
    const staleTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const code = resp.error.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          staleTokens.push(tokens[idx]);
        } else {
          console.warn(`[FCM] Gagal kirim ke token[${idx}] User ${userId}: ${code} - ${resp.error.message}`);
        }
      }
    });
    if (staleTokens.length > 0) {
      await pool.query(
        'DELETE FROM user_device_tokens WHERE user_id = ? AND fcm_token IN (?)',
        [userId, staleTokens]
      ).catch(() => {});
    }

    console.log(`[FCM] Notifikasi dikirim ke User ${userId}: ${response.successCount} berhasil, ${response.failureCount} gagal (${staleTokens.length} token usang dihapus).`);
  } catch (err) {
    console.error('[FCM] Gagal mengirim push notification:', err);
  }
};
