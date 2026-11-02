"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotificationToUser = void 0;
const messaging_1 = require("firebase-admin/messaging");
const firebase_js_1 = require("../config/firebase.js");
const database_js_1 = __importDefault(require("../config/database.js"));
const sendPushNotificationToUser = async (userId, title, body, dataPayload = {}) => {
    try {
        if (!firebase_js_1.isFirebaseInitialized) {
            console.log(`[FCM-MOCK] Firebase belum diinisialisasi. Simulasi Push Notif ke User ${userId}: [${title}] ${body}`);
            return;
        }
        // 1. Ambil seluruh device token milik user
        const [rows] = await database_js_1.default.query('SELECT fcm_token FROM user_device_tokens WHERE user_id = ?', [userId]);
        if (!rows || rows.length === 0)
            return;
        const tokens = rows.map((r) => r.fcm_token).filter(Boolean);
        if (tokens.length === 0)
            return;
        // 2. Kirim multicast pesan FCM
        const messaging = (0, messaging_1.getMessaging)();
        const response = await messaging.sendEachForMulticast({
            tokens,
            notification: { title, body },
            data: dataPayload,
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'dinoyocraft_channel',
                },
            },
        });
        console.log(`[FCM] Notifikasi dikirim ke User ${userId}: ${response.successCount} berhasil, ${response.failureCount} gagal.`);
    }
    catch (err) {
        console.error('[FCM] Gagal mengirim push notification:', err);
    }
};
exports.sendPushNotificationToUser = sendPushNotificationToUser;
//# sourceMappingURL=notificationService.js.map