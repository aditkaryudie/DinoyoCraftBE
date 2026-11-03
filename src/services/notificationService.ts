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

    // 2. Kirim multicast pesan FCM
    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: dataPayload,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
        },
      },
    });

    console.log(`[FCM] Notifikasi dikirim ke User ${userId}: ${response.successCount} berhasil, ${response.failureCount} gagal.`);
  } catch (err) {
    console.error('[FCM] Gagal mengirim push notification:', err);
  }
};
