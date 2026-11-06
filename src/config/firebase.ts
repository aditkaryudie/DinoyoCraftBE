import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { GoogleAuth, JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

const FIREBASE_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/firebase.database',
  'https://www.googleapis.com/auth/firebase.messaging',
  'https://www.googleapis.com/auth/identitytoolkit',
  'https://www.googleapis.com/auth/userinfo.email',
];

const serviceAccountPath = process.env['FIREBASE_SERVICE_ACCOUNT_PATH'] || './src/config/firebase-service-account.json';
const cwdResolvedPath = path.resolve(process.cwd(), serviceAccountPath);
const resolvedPath = fs.existsSync(cwdResolvedPath)
  ? cwdResolvedPath
  : path.resolve(__dirname, '../..', serviceAccountPath);

let isFirebaseInitialized = false;

if (fs.existsSync(resolvedPath)) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    if (getApps().length === 0) {
      const credential = cert(serviceAccount) as any;
      const jwtClient = new JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        keyId: serviceAccount.private_key_id,
        projectId: serviceAccount.project_id,
        scopes: FIREBASE_SCOPES,
      });
      credential.authClient = jwtClient;
      credential.googleAuth = new GoogleAuth({
        scopes: FIREBASE_SCOPES,
        authClient: jwtClient,
        projectId: serviceAccount.project_id,
      });
      initializeApp({
        credential,
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
