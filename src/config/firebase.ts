import { initializeApp, cert, getApps } from 'firebase-admin/app';
import fs from 'fs';
import path from 'path';

const serviceAccountPath = process.env['FIREBASE_SERVICE_ACCOUNT_PATH'] || './src/config/firebase-service-account.json';
const resolvedPath = path.resolve(process.cwd(), serviceAccountPath);

let isFirebaseInitialized = false;

if (fs.existsSync(resolvedPath)) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    if (getApps().length === 0) {
      initializeApp({
        credential: cert(serviceAccount),
      });
    }
    isFirebaseInitialized = true;
    console.log('✅ Firebase Admin SDK berhasil diinisialisasi.');
  } catch (err) {
    console.warn('⚠️ Gagal membaca Firebase service account file:', err);
  }
} else {
  console.warn('⚠️ File Firebase service account tidak ditemukan di:', resolvedPath);
}

export { isFirebaseInitialized };