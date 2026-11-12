"use strict";
// ============================================================
//  src/services/midtransService.ts
//  Instansi Midtrans (Core API + Snap) & helper verifikasi/status.
//  Server Key HANYA dibaca dari .env — tidak pernah ke client.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.snap = exports.coreApi = exports.isMidtransConfigured = exports.midtransIsProduction = void 0;
exports.reloadMidtransConfig = reloadMidtransConfig;
exports.isMidtransProductionMode = isMidtransProductionMode;
exports.getMidtransServerKey = getMidtransServerKey;
exports.getMidtransClientKey = getMidtransClientKey;
exports.getIsMidtransConfigured = getIsMidtransConfigured;
exports.assertMidtransConfigured = assertMidtransConfigured;
exports.formatMidtransChargeError = formatMidtransChargeError;
exports.verifySignatureKey = verifySignatureKey;
exports.mapMidtransStatus = mapMidtransStatus;
exports.platformFeeFor = platformFeeFor;
exports.chargeExpiryMinutes = chargeExpiryMinutes;
// @ts-ignore
const midtrans_client_1 = __importDefault(require("midtrans-client"));
const dotenv_1 = __importDefault(require("dotenv"));
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const ENV_PATH = path_1.default.resolve(process.cwd(), '.env');
let lastEnvMtimeMs = 0;
function readEnvState() {
    const isProduction = process.env['MIDTRANS_IS_PRODUCTION'] === 'true';
    const serverKey = (process.env['MIDTRANS_SERVER_KEY'] || '').trim();
    const clientKey = (process.env['MIDTRANS_CLIENT_KEY'] || '').trim();
    return { isProduction, serverKey, clientKey };
}
let currentState = readEnvState();
exports.midtransIsProduction = currentState.isProduction;
exports.isMidtransConfigured = Boolean(currentState.serverKey && currentState.clientKey);
exports.coreApi = new midtrans_client_1.default.CoreApi({
    isProduction: currentState.isProduction,
    serverKey: currentState.serverKey,
    clientKey: currentState.clientKey,
});
exports.snap = new midtrans_client_1.default.Snap({
    isProduction: currentState.isProduction,
    serverKey: currentState.serverKey,
    clientKey: currentState.clientKey,
});
/**
 * Muat ulang key Midtrans bila file .env diedit tanpa restart server.
 */
function reloadMidtransConfig() {
    try {
        if (fs_1.default.existsSync(ENV_PATH)) {
            const mtimeMs = fs_1.default.statSync(ENV_PATH).mtimeMs;
            if (mtimeMs !== lastEnvMtimeMs) {
                dotenv_1.default.config({ path: ENV_PATH, override: true });
                lastEnvMtimeMs = mtimeMs;
            }
        }
    }
    catch {
        // Abaikan error fs non-kritis, pakai process.env yang ada
    }
    const next = readEnvState();
    if (next.isProduction !== currentState.isProduction ||
        next.serverKey !== currentState.serverKey ||
        next.clientKey !== currentState.clientKey) {
        currentState = next;
        exports.coreApi.apiConfig.set(next);
        exports.snap.apiConfig.set(next);
    }
}
function isMidtransProductionMode() {
    reloadMidtransConfig();
    return currentState.isProduction;
}
function getMidtransServerKey() {
    reloadMidtransConfig();
    return currentState.serverKey;
}
function getMidtransClientKey() {
    reloadMidtransConfig();
    return currentState.clientKey;
}
function getIsMidtransConfigured() {
    reloadMidtransConfig();
    return Boolean(currentState.serverKey && currentState.clientKey);
}
function assertMidtransConfigured() {
    reloadMidtransConfig();
    if (!currentState.serverKey || !currentState.clientKey) {
        throw Object.assign(new Error('Konfigurasi Midtrans Sandbox belum diisi di .env (MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY).'), { status: 503 });
    }
}
/** Ubah error mentah Midtrans SDK menjadi pesan yang jelas saat otorisasi gagal (401). */
function formatMidtransChargeError(err) {
    reloadMidtransConfig();
    const apiMessage = err?.ApiResponses?.[0]?.status_message ||
        err?.ApiResponses?.[0]?.message ||
        err?.message ||
        '';
    const statusCode = Number(err?.httpStatusCode || 0);
    const isUnauthorized = statusCode === 401 || /\b401\b|Unauthorized/i.test(String(apiMessage));
    if (isUnauthorized) {
        const modeLabel = currentState.isProduction ? 'Production' : 'Sandbox';
        return (`Otorisasi Midtrans ${modeLabel} gagal (401 Unauthorized). ` +
            `Pastikan MIDTRANS_SERVER_KEY di .env diisi dengan Server Key aktif dari ` +
            `Midtrans Dashboard (${modeLabel}) → Settings → Access Keys → tabel Server Keys ` +
            `(klik Generate server key bila belum punya, jangan pakai Signature Secret Key atau Client Key).`);
    }
    return apiMessage || 'Gagal membuat tagihan di Midtrans Sandbox';
}
/**
 * Verifikasi signature_key webhook:
 * Mendukung Signature Secret Key (MIDTRANS_SIGNATURE_KEY pada dashboard baru)
 * maupun Server Key (MIDTRANS_SERVER_KEY untuk kompatibilitas lama).
 */
function verifySignatureKey(orderId, statusCode, grossAmount, signatureKey) {
    const activeServerKey = getMidtransServerKey();
    const signatureSecret = (process.env['MIDTRANS_SIGNATURE_KEY'] || '').trim();
    const candidateKeys = [signatureSecret, activeServerKey].filter(Boolean);
    if (candidateKeys.length === 0 || !signatureKey)
        return false;
    const actual = String(signatureKey).toLowerCase();
    for (const secret of candidateKeys) {
        const expected = crypto_1.default
            .createHash('sha512')
            .update(`${orderId}${statusCode}${grossAmount}${secret}`)
            .digest('hex')
            .toLowerCase();
        if (expected.length === actual.length &&
            crypto_1.default.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(actual, 'utf8'))) {
            return true;
        }
    }
    return false;
}
/** Pemetaan status Midtrans → status DinoyoCraft (PRD §3.3). */
function mapMidtransStatus(transactionStatus, fraudStatus) {
    switch (transactionStatus) {
        case 'capture':
            return fraudStatus === 'challenge' ? 'challenge' : 'paid';
        case 'settlement':
            return 'paid';
        case 'pending':
            return 'pending';
        case 'deny':
            return 'failed';
        case 'cancel':
            return 'cancelled';
        case 'expire':
            return 'expired';
        case 'refund':
        case 'partial_refund':
            // Di luar lingkup: hanya dipetakan agar tidak dianggap pending
            return 'failed';
        default:
            return 'pending';
    }
}
/**
 * Biaya platform yang dibebankan ke pembeli.
 * Fee channel Midtrans (QRIS 0,7% / VA 4rb / GoPay 2%) DITANGGUNG PLATFORM
 * dan tidak dibebankan terpisah — sehingga nominal di app, BE, dan Midtrans
 * selalu sama (PRD §5.5).
 */
function platformFeeFor(baseAmount) {
    const fixed = Number(process.env['PAYMENT_SERVICE_FEE_FIXED'] || 0);
    const percent = Number(process.env['PAYMENT_SERVICE_FEE_PERCENT'] || 0);
    return fixed + Math.round((baseAmount * percent) / 100);
}
/** Batas waktu bayar (menit) — dipakai untuk custom_expiry Midtrans. */
function chargeExpiryMinutes() {
    return Number(process.env['PAYMENT_EXPIRY_MINUTES'] || 1440);
}
//# sourceMappingURL=midtransService.js.map