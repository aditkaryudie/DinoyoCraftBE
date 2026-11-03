"use strict";
// ============================================================
//  src/services/paymentService.ts
//  Service Integrasi Payment Gateway SociaBuzz (100% Native TypeScript)
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentCountries = getPaymentCountries;
exports.calculateServiceFee = calculateServiceFee;
exports.calculatePaymentFees = calculatePaymentFees;
exports.createDonationSession = createDonationSession;
exports.fetchPaymentMethods = fetchPaymentMethods;
exports.initiatePayment = initiatePayment;
exports.processDirectPayment = processDirectPayment;
exports.verifyPaymentStatus = verifyPaymentStatus;
const dotenv_1 = __importDefault(require("dotenv"));
const sociabuzzClient_js_1 = __importStar(require("./sociabuzzClient.js"));
dotenv_1.default.config();
const SOCIABUZZ_USERNAME = process.env['SOCIABUZZ_USERNAME'] || 'dinoyocraft';
// Penyimpanan sesi in-memory sementara untuk token -> CookieJar
const activeJars = new Map();
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
async function getPaymentCountries() {
    const list = Object.entries(sociabuzzClient_js_1.SUPPORTED_COUNTRIES).map(([name, info]) => ({
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
function calculateServiceFee(baseAmount) {
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
const feeCache = new Map();
const FEE_CACHE_TTL = 10 * 60 * 1000;
function staticFeeFallback(countryName, currency, amount) {
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
async function calculatePaymentFees(country, amount, _username) {
    const countryName = (country || 'Indonesia').trim();
    const countryInfo = sociabuzzClient_js_1.SUPPORTED_COUNTRIES[countryName] || sociabuzzClient_js_1.SUPPORTED_COUNTRIES['Indonesia'];
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
        const jar = new sociabuzzClient_js_1.CookieJar();
        const estimates = await sociabuzzClient_js_1.default.estimateFees(countryName, Math.round(amount), SOCIABUZZ_USERNAME, jar);
        if (!estimates || estimates.length === 0)
            throw new Error('Tabel fee kosong');
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
    }
    catch (err) {
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
async function createDonationSession(params) {
    const targetUser = (params.username || SOCIABUZZ_USERNAME).trim();
    const country = (params.country || 'Indonesia').trim();
    const cleanEmail = (params.email || process.env['DEFAULT_DONOR_EMAIL'] || 'customer@dinoyocraft.com').trim();
    const cleanName = (params.fullname || process.env['DEFAULT_DONOR_NAME'] || 'Pelanggan DinoyoCraft').trim();
    const jar = new sociabuzzClient_js_1.CookieJar();
    const result = await sociabuzzClient_js_1.default.submitDonation(targetUser, params.amount, cleanName, cleanEmail, params.note || '', jar, country);
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
async function fetchPaymentMethods(token) {
    const session = activeJars.get(token);
    const jar = session ? session.jar : new sociabuzzClient_js_1.CookieJar();
    const amount = session ? session.amount : 10000;
    const country = session ? session.country : 'Indonesia';
    const settings = await sociabuzzClient_js_1.default.getPaymentSettings(token, amount, country, jar);
    return {
        success: true,
        token,
        methods: (settings.payment_channel || []).flatMap((g) => (g.available || []).map((m) => ({
            id: m.name,
            name: m.name,
            label: m.alias || m.name,
            group: (0, sociabuzzClient_js_1.groupLabel)(g.name),
            gateway: m.source || 'oy',
            active: !!m.active,
            fee: {
                fee_type: 'percent',
                fee_rate: m.fee_rate || '',
                total_fee: Number(m.total_fee ?? m.fee ?? 0),
                total_pay: Number(m.total_pay ?? 0),
            },
        }))),
    };
}
// 5. Buat tagihan pembayaran spesifik (QRIS / Payment URL)
async function initiatePayment(token, paymentMethod) {
    const session = activeJars.get(token);
    const jar = session ? session.jar : new sociabuzzClient_js_1.CookieJar();
    const amount = session ? session.amount : 10000;
    const country = session ? session.country : 'Indonesia';
    return await sociabuzzClient_js_1.default.createPayment(token, paymentMethod, amount, country, jar);
}
// 6. Alur Terpadu Cepat (End-to-End) — Sangat Optimal untuk Vercel Serverless
async function processDirectPayment(params) {
    const targetUser = (params.username || SOCIABUZZ_USERNAME).trim();
    const country = (params.country || 'Indonesia').trim();
    const cleanEmail = (params.email || process.env['DEFAULT_DONOR_EMAIL'] || 'customer@dinoyocraft.com').trim();
    const cleanName = (params.fullname || process.env['DEFAULT_DONOR_NAME'] || 'Pelanggan DinoyoCraft').trim();
    const jar = new sociabuzzClient_js_1.CookieJar();
    // Step 1: Submit form
    const donation = await sociabuzzClient_js_1.default.submitDonation(targetUser, params.amount, cleanName, cleanEmail, params.note || '', jar, country);
    // Step 2: Create payment (QRIS / URL)
    const payment = await sociabuzzClient_js_1.default.createPayment(donation.token, params.paymentMethod || 'qris', params.amount, country, jar);
    return payment;
}
// 7. Cek status pembayaran ke SociaBuzz
async function verifyPaymentStatus(token, paymentMethod, invId) {
    const status = await sociabuzzClient_js_1.default.checkPaymentStatus(token, paymentMethod, invId);
    return {
        success: true,
        token,
        status,
    };
}
//# sourceMappingURL=paymentService.js.map