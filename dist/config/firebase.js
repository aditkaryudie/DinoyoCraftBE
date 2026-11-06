"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFirebaseInitialized = void 0;
const app_1 = require("firebase-admin/app");
const google_auth_library_1 = require("google-auth-library");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const FIREBASE_SCOPES = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/firebase.database',
    'https://www.googleapis.com/auth/firebase.messaging',
    'https://www.googleapis.com/auth/identitytoolkit',
    'https://www.googleapis.com/auth/userinfo.email',
];
const serviceAccountPath = process.env['FIREBASE_SERVICE_ACCOUNT_PATH'] || './src/config/firebase-service-account.json';
const cwdResolvedPath = path_1.default.resolve(process.cwd(), serviceAccountPath);
const resolvedPath = fs_1.default.existsSync(cwdResolvedPath)
    ? cwdResolvedPath
    : path_1.default.resolve(__dirname, '../..', serviceAccountPath);
let isFirebaseInitialized = false;
exports.isFirebaseInitialized = isFirebaseInitialized;
if (fs_1.default.existsSync(resolvedPath)) {
    try {
        const serviceAccount = JSON.parse(fs_1.default.readFileSync(resolvedPath, 'utf8'));
        if ((0, app_1.getApps)().length === 0) {
            const credential = (0, app_1.cert)(serviceAccount);
            const jwtClient = new google_auth_library_1.JWT({
                email: serviceAccount.client_email,
                key: serviceAccount.private_key,
                keyId: serviceAccount.private_key_id,
                projectId: serviceAccount.project_id,
                scopes: FIREBASE_SCOPES,
            });
            credential.authClient = jwtClient;
            credential.googleAuth = new google_auth_library_1.GoogleAuth({
                scopes: FIREBASE_SCOPES,
                authClient: jwtClient,
                projectId: serviceAccount.project_id,
            });
            (0, app_1.initializeApp)({
                credential,
            });
        }
        exports.isFirebaseInitialized = isFirebaseInitialized = true;
        console.log('✅ Firebase Admin SDK berhasil diinisialisasi.');
    }
    catch (err) {
        console.warn('⚠️ Gagal membaca Firebase service account file:', err);
    }
}
else {
    console.warn('⚠️ File Firebase service account tidak ditemukan di:', resolvedPath);
}
//# sourceMappingURL=firebase.js.map