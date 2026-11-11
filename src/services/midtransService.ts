// ============================================================
//  src/services/midtransService.ts
//  Instansi Midtrans (Core API + Snap) & helper verifikasi/status.
//  Server Key HANYA dibaca dari .env — tidak pernah ke client.
// ============================================================

// @ts-ignore
import midtransClient from 'midtrans-client';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

dotenv.config();

const ENV_PATH = path.resolve(process.cwd(), '.env');
let lastEnvMtimeMs = 0;

function readEnvState() {
  const isProduction = process.env['MIDTRANS_IS_PRODUCTION'] === 'true';
  const serverKey = (process.env['MIDTRANS_SERVER_KEY'] || '').trim();
  const clientKey = (process.env['MIDTRANS_CLIENT_KEY'] || '').trim();
  return { isProduction, serverKey, clientKey };
}

let currentState = readEnvState();

export const midtransIsProduction = currentState.isProduction;
export const isMidtransConfigured = Boolean(currentState.serverKey && currentState.clientKey);

export const coreApi = new midtransClient.CoreApi({
  isProduction: currentState.isProduction,
  serverKey: currentState.serverKey,
  clientKey: currentState.clientKey,
});

export const snap = new midtransClient.Snap({
  isProduction: currentState.isProduction,
  serverKey: currentState.serverKey,
  clientKey: currentState.clientKey,
});

/**
 * Muat ulang key Midtrans bila file .env diedit tanpa restart server.
 */
export function reloadMidtransConfig(): void {
  try {
    if (fs.existsSync(ENV_PATH)) {
      const mtimeMs = fs.statSync(ENV_PATH).mtimeMs;
      if (mtimeMs !== lastEnvMtimeMs) {
        dotenv.config({ path: ENV_PATH, override: true });
        lastEnvMtimeMs = mtimeMs;
      }
    }
  } catch {
    // Abaikan error fs non-kritis, pakai process.env yang ada
  }

  const next = readEnvState();
  if (
    next.isProduction !== currentState.isProduction ||
    next.serverKey !== currentState.serverKey ||
    next.clientKey !== currentState.clientKey
  ) {
    currentState = next;
    (coreApi as any).apiConfig.set(next);
    (snap as any).apiConfig.set(next);
  }
}

export function isMidtransProductionMode(): boolean {
  reloadMidtransConfig();
  return currentState.isProduction;
}

export function getMidtransServerKey(): string {
  reloadMidtransConfig();
  return currentState.serverKey;
}

export function getMidtransClientKey(): string {
  reloadMidtransConfig();
  return currentState.clientKey;
}

export function getIsMidtransConfigured(): boolean {
  reloadMidtransConfig();
  return Boolean(currentState.serverKey && currentState.clientKey);
}

export function assertMidtransConfigured(): void {
  reloadMidtransConfig();
  if (!currentState.serverKey || !currentState.clientKey) {
    throw Object.assign(
      new Error('Konfigurasi Midtrans Sandbox belum diisi di .env (MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY).'),
      { status: 503 }
    );
  }
}

/** Ubah error mentah Midtrans SDK menjadi pesan yang jelas saat otorisasi gagal (401). */
export function formatMidtransChargeError(err: any): string {
  reloadMidtransConfig();
  const apiMessage =
    err?.ApiResponses?.[0]?.status_message ||
    err?.ApiResponses?.[0]?.message ||
    err?.message ||
    '';

  const statusCode = Number(err?.httpStatusCode || 0);
  const isUnauthorized =
    statusCode === 401 || /\b401\b|Unauthorized/i.test(String(apiMessage));

  if (isUnauthorized) {
    const modeLabel = currentState.isProduction ? 'Production' : 'Sandbox';
    return (
      `Otorisasi Midtrans ${modeLabel} gagal (401 Unauthorized). ` +
      `Pastikan MIDTRANS_SERVER_KEY di .env diisi dengan Server Key aktif dari ` +
      `Midtrans Dashboard (${modeLabel}) → Settings → Access Keys → tabel Server Keys ` +
      `(klik Generate server key bila belum punya, jangan pakai Signature Secret Key atau Client Key).`
    );
  }

  return apiMessage || 'Gagal membuat tagihan di Midtrans Sandbox';
}

/**
 * Verifikasi signature_key webhook:
 * Mendukung Signature Secret Key (MIDTRANS_SIGNATURE_KEY pada dashboard baru)
 * maupun Server Key (MIDTRANS_SERVER_KEY untuk kompatibilitas lama).
 */
export function verifySignatureKey(
  orderId: string,
  statusCode: string,
  grossAmount: string | number,
  signatureKey: string
): boolean {
  const activeServerKey = getMidtransServerKey();
  const signatureSecret = (process.env['MIDTRANS_SIGNATURE_KEY'] || '').trim();
  const candidateKeys = [signatureSecret, activeServerKey].filter(Boolean);
  if (candidateKeys.length === 0 || !signatureKey) return false;

  const actual = String(signatureKey).toLowerCase();
  for (const secret of candidateKeys) {
    const expected = crypto
      .createHash('sha512')
      .update(`${orderId}${statusCode}${grossAmount}${secret}`)
      .digest('hex')
      .toLowerCase();
    if (
      expected.length === actual.length &&
      crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(actual, 'utf8'))
    ) {
      return true;
    }
  }
  return false;
}

export type MidtransMappedStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'cancelled'
  | 'challenge';

/** Pemetaan status Midtrans → status DinoyoCraft (PRD §3.3). */
export function mapMidtransStatus(
  transactionStatus: string,
  fraudStatus?: string | null
): MidtransMappedStatus {
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
export function platformFeeFor(baseAmount: number): number {
  const fixed = Number(process.env['PAYMENT_SERVICE_FEE_FIXED'] || 0);
  const percent = Number(process.env['PAYMENT_SERVICE_FEE_PERCENT'] || 0);
  return fixed + Math.round((baseAmount * percent) / 100);
}

/** Batas waktu bayar (menit) — dipakai untuk custom_expiry Midtrans. */
export function chargeExpiryMinutes(): number {
  return Number(process.env['PAYMENT_EXPIRY_MINUTES'] || 1440);
}
