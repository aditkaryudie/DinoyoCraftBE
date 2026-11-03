// ============================================================
//  src/services/paymentService.ts
//  Service Integrasi Payment Gateway SociaBuzz (100% Native TypeScript)
// ============================================================

import dotenv from 'dotenv';
import sociabuzzClient, { CookieJar, SUPPORTED_COUNTRIES, groupLabel } from './sociabuzzClient.js';
dotenv.config();

const SOCIABUZZ_USERNAME = process.env['SOCIABUZZ_USERNAME'] || 'dinoyocraft';

// Penyimpanan sesi in-memory sementara untuk token -> CookieJar
const activeJars = new Map<string, { jar: CookieJar; createdAt: number; amount: number; country: string }>();

// Pembersihan sesi kadaluarsa setiap 15 menit
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of activeJars.entries()) {
    if (now - data.createdAt > 3600 * 1000) {
      activeJars.delete(token);
    }
  }
}, 15 * 60 * 1000).unref?.();

// 1. Ambil daftar negara yang didukung
export async function getPaymentCountries() {
  const list = Object.entries(SUPPORTED_COUNTRIES).map(([name, info]) => ({
    country: name,
    currency: info.currency,
    iso2: info.iso2,
  }));
  return {
    success: true,
    total: list.length,
    countries: list,
  };
}

/**
 * Hitung Biaya Layanan (Service Fee / Admin Fee)
 * Membantu agar merchant / penjual menerima hasil bersih
 * dan menutup biaya penarikan bank dari SociaBuzz.
 */
export function calculateServiceFee(baseAmount: number): {
  baseAmount: number;
  fixedFee: number;
  percentFee: number;
  totalServiceFee: number;
  finalAmountToPay: number;
} {
  const fixedFee = Number(process.env['PAYMENT_SERVICE_FEE_FIXED'] || 0);
  const percentRate = Number(process.env['PAYMENT_SERVICE_FEE_PERCENT'] || 0);
  const percentFee = Math.round(baseAmount * (percentRate / 100));
  const totalServiceFee = fixedFee + percentFee;
  const finalAmountToPay = baseAmount + totalServiceFee;

  return {
    baseAmount,
    fixedFee,
    percentFee,
    totalServiceFee,
    finalAmountToPay,
  };
}

// 2. Hitung estimasi fee pembayaran — LIVE dari SociaBuzz (port FeeCalculator
//    scbz Go) dengan cache 10 menit per kombinasi negara+nominal, dan fallback
//    statis bila gateway tidak dapat dihubungi.
interface CacheEntry {
  at: number;
  methods: any[];
}
const feeCache = new Map<string, CacheEntry>();
const FEE_CACHE_TTL = 10 * 60 * 1000;

function staticFeeFallback(countryName: string, currency: string, amount: number) {
  const fixedQrisFee = Math.max(100, Math.round(amount * 0.007)); // Standar QRIS 0.7%
  return [
    {
      id: 1,
      name: 'qris',
      label: 'QRIS (Semua Bank & E-Wallet)',
      group: 'QRIS',
      gateway: 'oy',
      fee: {
        fee_type: 'percent',
        fee_rate: '0.7%',
        total_fee: fixedQrisFee,
        total_pay: amount + fixedQrisFee,
      },
    },
    {
      id: 2,
      name: 'gopay',
      label: 'GoPay',
      group: 'E-Wallet',
      gateway: 'oy',
      fee: {
        fee_type: 'fixed',
        fee_rate: 'flat',
        total_fee: 1000,
        total_pay: amount + 1000,
      },
    },
  ].map((m) => ({ ...m, currency, country: countryName, live: false }));
}

export async function calculatePaymentFees(country: string, amount: number, _username?: string) {
  const countryName = (country || 'Indonesia').trim();
  const countryInfo = SUPPORTED_COUNTRIES[countryName] || SUPPORTED_COUNTRIES['Indonesia'];
  const currency = countryInfo.currency;
  const serviceFee = calculateServiceFee(amount);
  const cacheKey = `${countryName}:${Math.round(amount)}`;

  const cached = feeCache.get(cacheKey);
  if (cached && Date.now() - cached.at < FEE_CACHE_TTL) {
    return {
      success: true,
      country: countryName,
      currency,
      amount,
      service_fee: serviceFee,
      methods: cached.methods,
      live: true,
      cached: true,
    };
  }

  try {
    const jar = new CookieJar();
    const estimates = await sociabuzzClient.estimateFees(
      countryName,
      Math.round(amount),
      SOCIABUZZ_USERNAME,
      jar
    );
    if (!estimates || estimates.length === 0) throw new Error('Tabel fee kosong');

    const methods = estimates.map((e) => ({
      id: e.id,
      name: e.name,
      label: e.label,
      group: e.group,
      gateway: e.gateway,
      currency: e.currency,
      country: countryName,
      fee: e.fee,
      total_pay: e.fee.total_pay,
      live: true,
    }));
    feeCache.set(cacheKey, { at: Date.now(), methods });

    return {
      success: true,
      country: countryName,
      currency,
      amount,
      service_fee: serviceFee,
      methods,
      live: true,
      cached: false,
    };
  } catch (err: any) {
    console.warn('⚠️ [calculatePaymentFees] Fee live gagal, pakai fallback statis:', err.message);
    return {
      success: true,
      country: countryName,
      currency,
      amount,
      service_fee: serviceFee,
      methods: staticFeeFallback(countryName, currency, amount),
      live: false,
      cached: false,
    };
  }
}

// 3. Buat sesi donasi / pembayaran baru
export async function createDonationSession(params: {
  amount: number;
  fullname: string;
  email: string;
  note?: string;
  callback_url?: string;
  country?: string;
  username?: string;
}) {
  const targetUser = (params.username || SOCIABUZZ_USERNAME).trim();
  const country = (params.country || 'Indonesia').trim();
  const cleanEmail = (params.email || process.env['DEFAULT_DONOR_EMAIL'] || 'customer@dinoyocraft.com').trim();
  const cleanName = (params.fullname || process.env['DEFAULT_DONOR_NAME'] || 'Pelanggan DinoyoCraft').trim();

  const jar = new CookieJar();
  const result = await sociabuzzClient.submitDonation(
    targetUser,
    params.amount,
    cleanName,
    cleanEmail,
    params.note || '',
    jar,
    country
  );

  activeJars.set(result.token, {
    jar,
    createdAt: Date.now(),
    amount: params.amount,
    country,
  });

  return {
    success: true,
    token: result.token,
    country,
    currency: 'IDR',
    amount: result.actualAmount,
    redirect_url: result.redirectUrl,
    expires_in: 3600,
  };
}

// 4. Ambil metode pembayaran yang aktif untuk sebuah token sesi
export async function fetchPaymentMethods(token: string) {
  const session = activeJars.get(token);
  const jar = session ? session.jar : new CookieJar();
  const amount = session ? session.amount : 10000;
  const country = session ? session.country : 'Indonesia';

  const settings = await sociabuzzClient.getPaymentSettings(token, amount, country, jar);
  return {
    success: true,
    token,
    methods: (settings.payment_channel || []).flatMap((g: any) =>
      (g.available || []).map((m: any) => ({
        id: m.name,
        name: m.name,
        label: m.alias || m.name,
        group: groupLabel(g.name),
        gateway: m.source || 'oy',
        active: !!m.active,
        fee: {
          fee_type: 'percent',
          fee_rate: m.fee_rate || '',
          total_fee: Number(m.total_fee ?? m.fee ?? 0),
          total_pay: Number(m.total_pay ?? 0),
        },
      }))
    ),
  };
}

// 5. Buat tagihan pembayaran spesifik (QRIS / Payment URL)
export async function initiatePayment(token: string, paymentMethod: string) {
  const session = activeJars.get(token);
  const jar = session ? session.jar : new CookieJar();
  const amount = session ? session.amount : 10000;
  const country = session ? session.country : 'Indonesia';

  return await sociabuzzClient.createPayment(token, paymentMethod, amount, country, jar);
}

// 6. Alur Terpadu Cepat (End-to-End) — Sangat Optimal untuk Vercel Serverless
export async function processDirectPayment(params: {
  username?: string;
  amount: number;
  fullname: string;
  email: string;
  note?: string;
  paymentMethod: string;
  country?: string;
}) {
  const targetUser = (params.username || SOCIABUZZ_USERNAME).trim();
  const country = (params.country || 'Indonesia').trim();
  const cleanEmail = (params.email || process.env['DEFAULT_DONOR_EMAIL'] || 'customer@dinoyocraft.com').trim();
  const cleanName = (params.fullname || process.env['DEFAULT_DONOR_NAME'] || 'Pelanggan DinoyoCraft').trim();

  const jar = new CookieJar();

  // Step 1: Submit form
  const donation = await sociabuzzClient.submitDonation(
    targetUser,
    params.amount,
    cleanName,
    cleanEmail,
    params.note || '',
    jar,
    country
  );

  // Step 2: Create payment (QRIS / URL)
  const payment = await sociabuzzClient.createPayment(
    donation.token,
    params.paymentMethod || 'qris',
    params.amount,
    country,
    jar
  );

  return payment;
}

// 7. Cek status pembayaran ke SociaBuzz
export async function verifyPaymentStatus(token: string, paymentMethod: string, invId?: string) {
  const status = await sociabuzzClient.checkPaymentStatus(token, paymentMethod, invId);
  return {
    success: true,
    token,
    status,
  };
}
