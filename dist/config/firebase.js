"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFirebaseInitialized = void 0;
const app_1 = require("firebase-admin/app");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const serviceAccountPath = process.env['FIREBASE_SERVICE_ACCOUNT_PATH'] || './src/config/firebase-service-account.json';
const resolvedPath = path_1.default.resolve(process.cwd(), serviceAccountPath);
let isFirebaseInitialized = false;
exports.isFirebaseInitialized = isFirebaseInitialized;
if (fs_1.default.existsSync(resolvedPath)) {
    try {
        const serviceAccount = JSON.parse(fs_1.default.readFileSync(resolvedPath, 'utf8'));
        if ((0, app_1.getApps)().length === 0) {
            (0, app_1.initializeApp)({
                credential: (0, app_1.cert)(serviceAccount),
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