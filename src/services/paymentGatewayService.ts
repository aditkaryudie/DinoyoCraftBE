// ============================================================
//  src/services/paymentGatewayService.ts
//  Logika pembayaran Midtrans Core API (PRD_Midtrans_Sandbox §5):
//  createOrUpdateCharge · syncStatus · applyMidtransStatus · cancelCharge
//  Nominal SELALU dihitung dari DB, tidak pernah dari client.
// ============================================================

import crypto from 'crypto';
import pool from '../config/database.js';
import {
  assertMidtransConfigured,
  chargeExpiryMinutes,
  coreApi,
  formatMidtransChargeError,
  getIsMidtransConfigured,
  getMidtransServerKey,
  isMidtransProductionMode,
  mapMidtransStatus,
  platformFeeFor,
} from './midtransService.js';
import { settleOrderPaid } from './orderSettlement.js';
import {
  cancelOrExpireOrderPayment,
  expireOrder,
  OrderFailureReason,
} from './orderExpiry.js';

const DEFAULT_METHODS =
  'qris,bca_va,bni_va,bri_va,permata_va,mandiri_bill,gopay,shopeepay';

const METHOD_LABELS: Record<string, { label: string; group: string }> = {
  qris: { label: 'QRIS (Semua Bank & E-Wallet)', group: 'QRIS' },
  bca_va: { label: 'Virtual Account BCA', group: 'Virtual Account' },
  bni_va: { label: 'Virtual Account BNI', group: 'Virtual Account' },
  bri_va: { label: 'Virtual Account BRI', group: 'Virtual Account' },
  permata_va: { label: 'Virtual Account Permata', group: 'Virtual Account' },
  mandiri_bill: { label: 'Mandiri Bill Payment', group: 'Virtual Account' },
  gopay: { label: 'GoPay', group: 'E-Wallet' },
  shopeepay: { label: 'ShopeePay', group: 'E-Wallet' },
};

export interface EnabledMethod {
  id: string;
  name: string;
  label: string;
  group: string;
  payment_type: string;
}

function getEnabledMethodNames(): string[] {
  return (process.env['PAYMENT_ENABLED_METHODS'] || DEFAULT_METHODS)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}

/** Daftar metode aktif dari env (GET /payments/methods). */
export function getEnabledMethods(): EnabledMethod[] {
  return getEnabledMethodNames().map((name, i) => ({
    id: String(i + 1),
    name,
    label: METHOD_LABELS[name]?.label ?? name,
    group: METHOD_LABELS[name]?.group ?? 'Lainnya',
    payment_type: paymentTypeOf(name),
  }));
}

/** Info lengkap metode aktif + biaya layanan platform untuk Mobile/FE. */
export function getPaymentMethodsPayload() {
  return {
    gateway: 'midtrans',
    is_production: isMidtransProductionMode(),
    is_configured: getIsMidtransConfigured(),
    service_fee_fixed: Number(process.env['PAYMENT_SERVICE_FEE_FIXED'] || 1000),
    service_fee_percent: Number(process.env['PAYMENT_SERVICE_FEE_PERCENT'] || 5),
    channel_fee: 0,
    methods: getEnabledMethods(),
  };
}

/** Metode Midtrans valid = ada di env. */
export function isMethodEnabled(method: string): boolean {
  return getEnabledMethodNames().includes(method);
}

function paymentTypeOf(method: string): string {
  if (method === 'qris') return 'qris';
  if (method === 'gopay') return 'gopay';
  if (method === 'shopeepay') return 'shopeepay';
  if (method === 'mandiri_bill') return 'echannel';
  if (method.endsWith('_va')) return 'bank_transfer';
  return method;
}

/** Parse tanggal Midtrans ("YYYY-MM-DD HH:mm:ss" WIB / ISO) atau Date JS menjadi Date valid. */
export function parseGatewayDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val;
  }
  const str = String(val).trim();
  if (!str) return null;

  // Format Midtrans/MySQL tanpa offset: "2026-11-12 13:02:00" -> anggap WIB (+07:00)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
    const d = new Date(str.replace(' ', 'T') + '+07:00');
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // Format Midtrans dengan offset spasi: "2026-11-12 13:02:00 +0700"
  const m = str.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2}):?(\d{2})$/);
  if (m) {
    const d = new Date(`${m[1]}T${m[2]}${m[3]}:${m[4]}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Konversi ke format MySQL DATETIME WIB (YYYY-MM-DD HH:mm:ss). */
export function toMysqlWibDatetime(val: unknown): string | null {
  const d = parseGatewayDate(val);
  if (!d) return null;
  // Geser ke WIB (UTC+7) secara deterministik
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())} ${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}:${pad(wib.getUTCSeconds())}`;
}

/** Format ISO-8601 WIB (+07:00) agar client Mobile akurat menghitung countdown. */
export function toIsoWibString(val: unknown): string | null {
  const d = parseGatewayDate(val);
  if (!d) return null;
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())}T${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}:${pad(wib.getUTCSeconds())}+07:00`;
}

/**
 * Hitung batas waktu pembayaran tetap untuk satu pesanan.
 * Selalu mengacu pada waktu pesanan pertama kali dibuat (created_at + durasi expiry)
 * agar tidak pernah reset ke 24 jam saat keluar/buka ulang atau ganti metode pembayaran.
 */
export function computeOrderDeadline(orderCreatedAt: unknown, existingExpiry?: unknown): Date {
  const expiryMs = chargeExpiryMinutes() * 60 * 1000;
  const created = parseGatewayDate(orderCreatedAt);
  const existing = parseGatewayDate(existingExpiry);

  if (created) {
    const anchoredDeadline = new Date(created.getTime() + expiryMs);
    if (existing && existing.getTime() < anchoredDeadline.getTime()) {
      return existing;
    }
    return anchoredDeadline;
  }
  return existing ?? new Date(Date.now() + expiryMs);
}

function parseJsonSafe(raw: unknown): Record<string, any> | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

export interface OrderPaymentContext {
  order: any;
  trx: any;
  items: Array<{ product_id: number; name: string; price: number; quantity: number }>;
  baseAmount: number;
  shippingCost: number;
  platformFee: number;
  grossAmount: number;
  customer: { name: string; email: string; phone: string };
  referenceCode: string;
  mitraUserId: number;
}

/** Muat konteks lengkap satu order untuk pembayaran. */
export async function loadOrderContext(orderId: number): Promise<OrderPaymentContext | null> {
  const [orders]: any = await pool.query(
    `SELECT o.*, t.id AS transaction_id, t.reference_code, t.status AS transaction_status,
            t.transaction_type, t.gateway, t.gateway_order_id, t.payment_type, t.bank,
            t.gateway_fee, t.expiry_time, t.paid_at, t.va_number, t.qr_string,
            t.payment_url, t.payment_token AS stored_token, t.gateway_response,
            u.name AS user_name, u.email AS user_email, u.phone AS user_phone,
            m.user_id AS mitra_user_id
     FROM orders o
     JOIN transactions t ON o.transaction_id = t.id
     JOIN users u ON o.user_id = u.id
     JOIN mitra_profiles m ON o.mitra_id = m.id
     WHERE o.id = ?
     LIMIT 1`,
    [orderId]
  );
  if (!orders || orders.length === 0) return null;
  const order = orders[0];

  const [items]: any = await pool.query(
    `SELECT oi.product_id, oi.quantity, oi.unit_price, p.name
     FROM order_items oi JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = ?`,
    [orderId]
  );

  const baseAmount = Math.round(Number(order.total_amount || 0));
  const platformFee = platformFeeFor(baseAmount);

  // Telepon: dari alamat pengiriman order / alamat default, fallback ke users.phone
  let phone = order.user_phone || '';
  try {
    if (order.address_id) {
      const [orderAddr]: any = await pool.query(
        'SELECT phone FROM user_addresses WHERE id = ? LIMIT 1',
        [order.address_id]
      );
      if (orderAddr?.[0]?.phone) phone = orderAddr[0].phone;
    }
    if (!phone) {
      const [addr]: any = await pool.query(
        'SELECT phone FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, id ASC LIMIT 1',
        [order.user_id]
      );
      if (addr?.[0]?.phone) phone = addr[0].phone;
    }
  } catch {
    // abaikan error non-kritis
  }

  return {
    order,
    trx: {
      id: order.transaction_id,
      status: order.transaction_status,
      transaction_type: order.transaction_type,
      gateway: order.gateway,
      gateway_order_id: order.gateway_order_id,
      payment_type: order.payment_type,
      bank: order.bank,
      gateway_fee: Number(order.gateway_fee || 0),
      expiry_time: order.expiry_time,
      paid_at: order.paid_at,
      va_number: order.va_number,
      qr_string: order.qr_string,
      payment_url: order.payment_url,
      stored_token: order.stored_token,
      gateway_response: parseJsonSafe(order.gateway_response),
    },
    items: (items || []).map((it: any) => ({
      product_id: it.product_id,
      name: it.name,
      price: Math.round(Number(it.unit_price || 0)),
      quantity: Number(it.quantity || 0),
    })),
    baseAmount,
    shippingCost: Math.round(Number(order.shipping_cost || 0)),
    platformFee,
    grossAmount: baseAmount + platformFee,
    customer: {
      name: order.user_name || 'Customer DinoyoCraft',
      email: order.user_email || 'customer@dinoyocraft.com',
      phone,
    },
    referenceCode: order.reference_code || `ORDER-${orderId}`,
    mitraUserId: order.mitra_user_id,
  };
}

/** Bangun payload charge Midtrans Core API (PRD §5.2). */
function buildChargePayload(
  ctx: OrderPaymentContext,
  gatewayOrderId: string,
  method: string,
  expiryMinutes = chargeExpiryMinutes()
) {
  const itemDetails: Array<{ id: string; name: string; price: number; quantity: number }> = [
    ...ctx.items.map((it) => ({
      id: String(it.product_id),
      name: (it.name || 'Produk Keramik').slice(0, 50),
      price: it.price,
      quantity: it.quantity,
    })),
  ];

  if (ctx.shippingCost > 0) {
    itemDetails.push({
      id: 'ongkir',
      name: 'Biaya Pengiriman',
      price: ctx.shippingCost,
      quantity: 1,
    });
  }
  if (ctx.platformFee > 0) {
    itemDetails.push({
      id: 'biaya_layanan',
      name: 'Biaya Layanan',
      price: ctx.platformFee,
      quantity: 1,
    });
  }

  // Pastikan total item_details sama persis dengan gross_amount (syarat Midtrans Core API).
  const itemsSum = itemDetails.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const diff = ctx.grossAmount - itemsSum;
  if (diff > 0) {
    itemDetails.push({
      id: 'penyesuaian',
      name: 'Penyesuaian Tagihan',
      price: diff,
      quantity: 1,
    });
  }

  const finalGrossAmount = Math.max(ctx.grossAmount, itemsSum);
  const nameParts = ctx.customer.name.trim().split(/\s+/);

  const base: Record<string, any> = {
    payment_type: paymentTypeOf(method),
    transaction_details: {
      order_id: gatewayOrderId,
      gross_amount: finalGrossAmount,
    },
    custom_expiry: {
      expiry_duration: Math.max(1, Math.floor(expiryMinutes)),
      unit: 'minute',
    },
    item_details: itemDetails,
    customer_details: {
      first_name: nameParts[0] || 'Customer',
      last_name: nameParts.slice(1).join(' ') || 'DinoyoCraft',
      email: ctx.customer.email,
      phone: ctx.customer.phone || undefined,
    },
  };

  switch (method) {
    case 'qris':
      base.qris = { acquirer: 'gopay' };
      break;
    case 'bca_va':
    case 'bni_va':
    case 'bri_va':
      base.bank_transfer = { bank: method.replace('_va', '') };
      break;
    case 'permata_va':
      base.bank_transfer = { bank: 'permata' };
      break;
    case 'mandiri_bill':
      base.echannel = {
        bill_info1: 'Pembayaran DinoyoCraft',
        bill_info2: ctx.referenceCode,
      };
      break;
    case 'gopay':
      base.gopay = { enable_callback: true, callback_url: 'dinoyocraft://payment' };
      break;
    case 'shopeepay':
      base.shopeepay = { callback_url: 'dinoyocraft://payment' };
      break;
    default:
      break;
  }

  return base;
}

/** Ekstrak data pembayaran dari respons charge per metode (PRD §5.2). */
function extractChargeData(method: string, charge: any) {
  const actions: any[] = Array.isArray(charge?.actions) ? charge.actions : [];
  const findAction = (name: string) => actions.find((a) => a?.name === name)?.url || null;

  let vaNumber: string | null = null;
  let bank: string | null = null;
  let billerCode: string | null = null;

  if (method.endsWith('_va') && method !== 'permata_va') {
    bank = method.replace('_va', '');
    vaNumber = charge?.va_numbers?.[0]?.va_number ?? null;
  } else if (method === 'permata_va') {
    bank = 'permata';
    vaNumber = charge?.permata_va_number ?? charge?.va_numbers?.[0]?.va_number ?? null;
  } else if (method === 'mandiri_bill') {
    bank = 'mandiri';
    billerCode = charge?.biller_code ?? null;
    vaNumber = charge?.bill_key ?? null; // bill_key disimpan di kolom va_number
  }

  return {
    transactionId: charge?.transaction_id ?? null,
    qrString: charge?.qr_string ?? null,
    qrImageUrl: findAction('generate-qr-code'),
    deeplinkUrl:
      findAction('deeplink-redirect') ||
      findAction('activate-deeplink') ||
      charge?.redirect_url ||
      null,
    vaNumber,
    bank,
    billerCode,
  };
}

/**
 * Buat atau ambil ulang charge Midtrans untuk satu order (idempoten).
 * Melempar Error ber-{status} bila validasi gagal.
 */
export async function createOrUpdateCharge(
  userId: number,
  role: string,
  orderId: number,
  method: string
): Promise<Record<string, any>> {
  if (!isMethodEnabled(method)) {
    throw Object.assign(new Error(`Metode pembayaran "${method}" tidak tersedia.`), { status: 400 });
  }

  const ctx = await loadOrderContext(orderId);
  if (!ctx) throw Object.assign(new Error('Pesanan tidak ditemukan.'), { status: 404 });

  if (ctx.order.user_id !== userId && role !== 'admin') {
    throw Object.assign(new Error('Anda tidak berhak membayar pesanan ini.'), { status: 403 });
  }
  if (ctx.order.status === 'paid' || ctx.trx.status === 'success') {
    throw Object.assign(new Error('Pesanan ini sudah dibayar.'), { status: 400 });
  }
  if (ctx.order.status === 'cancelled') {
    throw Object.assign(new Error('Pesanan ini telah dibatalkan.'), { status: 400 });
  }
  if (ctx.trx.status !== 'pending') {
    throw Object.assign(
      new Error(`Transaksi berstatus ${ctx.trx.status}. Silakan buat pesanan baru.`),
      { status: 400 }
    );
  }

  const deadline = computeOrderDeadline(ctx.order.created_at, ctx.trx.expiry_time);
  const remainingMs = deadline.getTime() - Date.now();
  if (remainingMs <= 0) {
    if (ctx.trx.gateway_order_id && getIsMidtransConfigured()) {
      await cancelRemoteChargeIfAny(ctx.trx.gateway_order_id);
    }
    await expireOrder({
      id: ctx.trx.id,
      order_id: ctx.order.id,
      user_id: ctx.order.user_id,
      mitra_user_id: ctx.mitraUserId,
      total_amount: ctx.baseAmount,
    });
    throw Object.assign(new Error('Batas waktu pembayaran sudah habis.'), { status: 400 });
  }
  const methodGroup = paymentTypeOf(method);

  // ── IDEMPOTEN: sesi aktif dengan metode sama & belum expired → kembalikan data tersimpan
  if (ctx.trx.gateway_order_id && ctx.trx.status === 'pending') {
    const sameBank =
      methodGroup !== 'bank_transfer' || ctx.trx.bank === method.replace('_va', '');
    const sameMethod = ctx.trx.payment_type === methodGroup && sameBank;

    if (sameMethod) {
      const savedRaw = ctx.trx.gateway_response;
      const savedActions: any[] = Array.isArray(savedRaw?.actions) ? savedRaw.actions : [];
      const savedQrUrl =
        savedActions.find((a) => a?.name === 'generate-qr-code')?.url ||
        (method === 'qris' && ctx.trx.stored_token
          ? `https://api.${isMidtransProductionMode() ? '' : 'sandbox.'}midtrans.com/v2/qris/${ctx.trx.stored_token}/qr-code`
          : null);
      const savedBillerCode =
        method === 'mandiri_bill' ? savedRaw?.biller_code ?? null : null;
      const isVaOrBill =
        ctx.trx.payment_type === 'bank_transfer' || ctx.trx.payment_type === 'echannel';

      return buildResponse(
        ctx,
        method,
        {
          gatewayOrderId: ctx.trx.gateway_order_id,
          transactionId: ctx.trx.stored_token,
          qrString: ctx.trx.qr_string,
          qrImageUrl: savedQrUrl,
          deeplinkUrl: ctx.trx.payment_url,
          vaNumber: isVaOrBill ? ctx.trx.va_number : null,
          bank: ctx.trx.bank,
          billerCode: savedBillerCode,
          expiryTime: toIsoWibString(deadline),
        },
        true
      );
    }
  }

  assertMidtransConfigured();

  // ── Beda metode / expired: batalkan charge lama di Midtrans (best-effort)
  if (ctx.trx.gateway_order_id) {
    await cancelRemoteChargeIfAny(ctx.trx.gateway_order_id);
  }

  // ── gateway_order_id baru: REFERENCE-R{n}
  const attempt = extractAttempt(ctx.trx.gateway_order_id) + 1;
  const gatewayOrderId = `${ctx.referenceCode}-R${attempt}`;

  const remainingMinutes = Math.max(1, Math.floor(remainingMs / 60000));
  const payload = buildChargePayload(ctx, gatewayOrderId, method, remainingMinutes);
  let charge: any;
  try {
    charge = await coreApi.charge(payload);
  } catch (err: any) {
    throw Object.assign(new Error(formatMidtransChargeError(err)), { status: 502 });
  }

  const data = extractChargeData(method, charge);
  const mysqlExpiry = toMysqlWibDatetime(deadline);
  const isoExpiry = toIsoWibString(deadline);

  await pool.query(
    `UPDATE transactions SET
       transaction_type = ?,
       gateway = 'midtrans',
       gateway_order_id = ?,
       payment_token = ?,
       payment_type = ?,
       va_number = ?,
       bank = ?,
       qr_string = ?,
       payment_url = ?,
       expiry_time = ?,
       gateway_fee = ?,
       gateway_response = ?,
       status = 'pending'
     WHERE id = ?`,
    [
      method,
      gatewayOrderId,
      data.transactionId,
      paymentTypeOf(method),
      data.vaNumber,
      data.bank,
      data.qrString,
      data.deeplinkUrl,
      mysqlExpiry,
      ctx.platformFee,
      JSON.stringify(charge),
      ctx.trx.id,
    ]
  );

  return buildResponse(
    ctx,
    method,
    {
      gatewayOrderId,
      transactionId: data.transactionId,
      qrString: data.qrString,
      qrImageUrl: data.qrImageUrl,
      deeplinkUrl: data.deeplinkUrl,
      vaNumber: data.vaNumber,
      bank: data.bank,
      billerCode: data.billerCode,
      expiryTime: isoExpiry,
    },
    false
  );
}

function simulatorSigningKey(): string {
  return (process.env['JWT_SECRET'] || getMidtransServerKey() || 'dinoyocraft-sandbox-sim').trim();
}

function signSandboxSimulator(orderId: number, gatewayOrderId: string): string {
  return crypto
    .createHmac('sha256', simulatorSigningKey())
    .update(`${orderId}:${gatewayOrderId}`)
    .digest('hex')
    .slice(0, 32);
}

function verifySandboxSimulatorSig(orderId: number, gatewayOrderId: string, sig: string): boolean {
  if (!sig) return false;
  const expected = signSandboxSimulator(orderId, gatewayOrderId);
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(sig, 'utf8'));
}

export function buildSandboxSimulatorPath(orderId: number, gatewayOrderId: string): string {
  const sig = signSandboxSimulator(orderId, gatewayOrderId);
  return `/api/payments/sandbox-simulator/${orderId}?ref=${encodeURIComponent(gatewayOrderId)}&sig=${sig}`;
}

function escapeHtml(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statusPageHtml(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - DinoyoCraft</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#111827;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px}
    .card{max-width:420px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.05)}
    h1{font-size:18px;margin:0 0 8px}
    p{font-size:14px;line-height:1.5;color:#4b5563;margin:0}
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}

function resolveSimulatorFormTarget(
  ctx: OrderPaymentContext
): { action: string; fields: Record<string, string> } | null {
  const method = ctx.trx.transaction_type;
  const vaNumber = String(ctx.trx.va_number || '');

  if (method === 'qris') {
    const actions: any[] = Array.isArray(ctx.trx.gateway_response?.actions)
      ? ctx.trx.gateway_response.actions
      : [];
    const qrUrl =
      actions.find((a) => a?.name === 'generate-qr-code')?.url ||
      (ctx.trx.stored_token
        ? `https://api.sandbox.midtrans.com/v2/qris/${ctx.trx.stored_token}/qr-code`
        : '');
    if (!qrUrl) return null;
    return {
      action: 'https://simulator.sandbox.midtrans.com/v2/qris/payment',
      fields: { qrCodeUrl: qrUrl },
    };
  }

  if (method === 'bca_va' || method === 'bni_va') {
    if (!vaNumber) return null;
    const bank = method.replace('_va', '');
    return {
      action: `https://simulator.sandbox.midtrans.com/${bank}/va/inquiry`,
      fields: { va_number: vaNumber },
    };
  }

  if (method === 'bri_va' || method === 'permata_va') {
    if (!vaNumber) return null;
    const bank = method.replace('_va', '');
    return {
      action: `https://simulator.sandbox.midtrans.com/openapi/va/inquiry?bank=${bank}`,
      fields: { bank: bank.toUpperCase(), vaNumber },
    };
  }

  if (method === 'mandiri_bill') {
    const billerCode = String(ctx.trx.gateway_response?.biller_code || '70012');
    const billKey = String(vaNumber || ctx.trx.gateway_response?.bill_key || '');
    if (!billKey) return null;
    return {
      action: 'https://simulator.sandbox.midtrans.com/openapi/va/inquiry?bank=mandiri',
      fields: {
        bank: 'MANDIRI',
        billerCode,
        billKey,
        vaNumber: `${billerCode}${billKey}`,
      },
    };
  }

  return null;
}

/**
 * Render halaman auto-submit POST menuju Midtrans Sandbox Simulator
 * agar VA & QRIS dapat dibayar satu klik seperti e-wallet pada mode Sandbox.
 */
export async function getSandboxSimulatorPage(
  orderId: number,
  ref: string,
  sig: string
): Promise<{ status: number; html: string; redirectUrl?: string }> {
  if (isMidtransProductionMode()) {
    return {
      status: 403,
      html: statusPageHtml('Mode Production', 'Halaman simulator hanya tersedia dalam mode Sandbox.'),
    };
  }

  if (!ref || !verifySandboxSimulatorSig(orderId, ref, sig)) {
    return {
      status: 403,
      html: statusPageHtml(
        'Tautan Simulator Tidak Valid',
        'Tanda tangan tautan tidak valid. Silakan kembali ke aplikasi DinoyoCraft dan tekan ulang tombol bayar.'
      ),
    };
  }

  const ctx = await loadOrderContext(orderId);
  if (!ctx) {
    return {
      status: 404,
      html: statusPageHtml('Pesanan Tidak Ditemukan', 'Data pesanan tidak ditemukan.'),
    };
  }

  if (ctx.order.status === 'paid' || ctx.trx.status === 'success') {
    return {
      status: 200,
      html: statusPageHtml(
        'Pembayaran Sudah Berhasil',
        `Pesanan #${orderId} sudah lunas. Silakan kembali ke aplikasi DinoyoCraft.`
      ),
    };
  }

  if (ctx.order.status !== 'pending' || ctx.trx.status !== 'pending') {
    return {
      status: 400,
      html: statusPageHtml(
        'Tagihan Tidak Aktif',
        `Tagihan berstatus ${ctx.order.status}. Silakan kembali ke aplikasi DinoyoCraft.`
      ),
    };
  }

  if (ctx.trx.gateway_order_id !== ref) {
    return {
      status: 409,
      html: statusPageHtml(
        'Sesi Pembayaran Diperbarui',
        'Anda sudah memilih metode pembayaran baru. Silakan kembali ke aplikasi DinoyoCraft untuk melanjutkan.'
      ),
    };
  }

  if (
    (ctx.trx.transaction_type === 'gopay' || ctx.trx.transaction_type === 'shopeepay') &&
    ctx.trx.payment_url
  ) {
    return { status: 302, html: '', redirectUrl: ctx.trx.payment_url };
  }

  const formTarget = resolveSimulatorFormTarget(ctx);
  if (!formTarget) {
    return {
      status: 400,
      html: statusPageHtml(
        'Simulator Tidak Tersedia',
        'Data Virtual Account / QRIS belum tersedia untuk metode ini. Silakan muat ulang di aplikasi.'
      ),
    };
  }

  const inputsHtml = Object.entries(formTarget.fields)
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}" />`)
    .join('\n      ');

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mengarahkan ke Midtrans Sandbox - DinoyoCraft</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#111827;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px}
    .card{max-width:400px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.05)}
    h1{font-size:17px;margin:0 0 8px}
    p{font-size:13px;color:#4b5563;margin:0 0 18px;line-height:1.5}
    button{background:#111827;color:#fff;border:0;border-radius:999px;padding:12px 20px;font-size:14px;font-weight:700;cursor:pointer;width:100%}
  </style>
</head>
<body>
  <div class="card">
    <h1>Membuka Simulator Midtrans...</h1>
    <p>Menyiapkan tagihan pesanan #${escapeHtml(orderId)} di Midtrans Sandbox. Jika tidak otomatis dialihkan, tekan tombol di bawah.</p>
    <form id="simForm" action="${escapeHtml(formTarget.action)}" method="POST">
      ${inputsHtml}
      <button type="submit">Lanjut ke Pembayaran Sandbox</button>
    </form>
  </div>
  <script>
    window.addEventListener('DOMContentLoaded', function () {
      var form = document.getElementById('simForm');
      if (form) form.submit();
    });
  </script>
</body>
</html>`;

  return { status: 200, html };
}

function buildResponse(
  ctx: OrderPaymentContext,
  method: string,
  data: {
    gatewayOrderId: string;
    transactionId: string | null;
    qrString: string | null;
    qrImageUrl: string | null;
    deeplinkUrl: string | null;
    vaNumber: string | null;
    bank: string | null;
    billerCode: string | null;
    expiryTime: string | null;
  },
  reused: boolean
) {
  const effectiveDeeplinkUrl =
    data.deeplinkUrl ||
    (!isMidtransProductionMode() && data.gatewayOrderId
      ? buildSandboxSimulatorPath(ctx.order.id, data.gatewayOrderId)
      : null);

  return {
    order_id: ctx.order.id,
    transaction_id: ctx.trx.id,
    reference_code: ctx.referenceCode,
    gateway: 'midtrans',
    gateway_order_id: data.gatewayOrderId,
    payment_method: method,
    payment_type: paymentTypeOf(method),
    label: METHOD_LABELS[method]?.label ?? method,
    base_amount: ctx.baseAmount,
    service_fee: ctx.platformFee,
    channel_fee: 0,
    amount: ctx.grossAmount,
    total_pay: ctx.grossAmount,
    qr_string: data.qrString,
    qr_image_url: data.qrImageUrl,
    va_number: data.vaNumber,
    bank: data.bank,
    biller_code: data.billerCode,
    deeplink_url: effectiveDeeplinkUrl,
    payment_url: effectiveDeeplinkUrl,
    token: data.transactionId,
    expiry_time: data.expiryTime,
    payment_status: 'pending',
    reused,
  };
}

function extractAttempt(gatewayOrderId: string | null): number {
  if (!gatewayOrderId) return 0;
  const m = gatewayOrderId.match(/-R(\d+)$/);
  return m ? parseInt(m[1], 10) : 1;
}

/** Validasi gross_amount notifikasi/status agar cocok dengan tagihan order di DB. */
function assertMatchingGrossAmount(
  trx: { total_amount: number; gateway_fee?: number },
  grossAmount?: string | number
): void {
  if (grossAmount === undefined || grossAmount === null || String(grossAmount).trim() === '') {
    return;
  }
  const incoming = Math.round(Number(grossAmount));
  if (Number.isNaN(incoming) || incoming <= 0) return;

  const base = Math.round(Number(trx.total_amount || 0));
  const savedFee = Math.round(Number(trx.gateway_fee || 0));

  if (savedFee > 0) {
    const expected = base + savedFee;
    if (Math.abs(incoming - expected) > 1) {
      throw Object.assign(
        new Error(`Nominal Midtrans (${incoming}) tidak cocok dengan tagihan (${expected}).`),
        { status: 400 }
      );
    }
    return;
  }

  const expectedWithFee = base + platformFeeFor(base);
  if (Math.abs(incoming - expectedWithFee) > 1 && Math.abs(incoming - base) > 1) {
    throw Object.assign(
      new Error(`Nominal Midtrans (${incoming}) tidak cocok dengan tagihan pesanan.`),
      { status: 400 }
    );
  }
}

export type ResolvedPaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled';

/** Terapkan status Midtrans ke DB (dipakai webhook, polling, dan poller). */
export async function applyMidtransStatus(
  trx: {
    id: number;
    order_id: number;
    user_id: number;
    mitra_user_id: number;
    total_amount: number;
    gateway_fee?: number;
    status: string;
  },
  transactionStatus: string,
  fraudStatus: string | null | undefined,
  grossAmount: string | number | undefined,
  raw?: any
): Promise<ResolvedPaymentStatus> {
  assertMatchingGrossAmount(trx, grossAmount);

  const mapped = mapMidtransStatus(transactionStatus, fraudStatus);

  if (mapped === 'paid') {
    await settleOrderPaid({
      id: trx.id,
      order_id: trx.order_id,
      user_id: trx.user_id,
      mitra_user_id: trx.mitra_user_id,
      total_amount: trx.total_amount,
    });
    await pool.query(
      'UPDATE transactions SET paid_at = COALESCE(paid_at, NOW()), gateway_response = ? WHERE id = ?',
      [JSON.stringify(raw ?? null), trx.id]
    );
    return 'paid';
  }

  if (mapped === 'expired' || mapped === 'failed' || mapped === 'cancelled') {
    await cancelOrExpireOrderPayment(trx, mapped as OrderFailureReason, raw);
    return mapped;
  }

  // pending / challenge — simpan respons mentah untuk debug
  await pool.query('UPDATE transactions SET gateway_response = ? WHERE id = ?', [
    JSON.stringify(raw ?? null),
    trx.id,
  ]);
  return 'pending';
}

/** Tarik status terbaru dari Midtrans untuk satu transaksi pending. */
export async function syncStatusFromMidtrans(trx: {
  id: number;
  order_id: number;
  user_id: number;
  mitra_user_id: number;
  total_amount: number;
  gateway_fee?: number;
  status: string;
  gateway_order_id: string | null;
}): Promise<ResolvedPaymentStatus> {
  if (!trx.gateway_order_id || !getIsMidtransConfigured()) return 'pending';
  try {
    const status: any = await coreApi.transaction.status(trx.gateway_order_id);
    return await applyMidtransStatus(
      trx,
      status.transaction_status,
      status.fraud_status,
      status.gross_amount,
      status
    );
  } catch (err: any) {
    console.warn('[Midtrans] Gagal sync status:', err?.message || err);
    return 'pending';
  }
}

/** Cek & sinkronkan status pembayaran order untuk endpoint GET /payments/status/:orderId. */
export async function checkAndSyncOrderPayment(
  userId: number,
  role: string,
  orderId: number
): Promise<Record<string, any>> {
  const ctx = await loadOrderContext(orderId);
  if (!ctx) throw Object.assign(new Error('Pesanan tidak ditemukan.'), { status: 404 });

  if (ctx.order.user_id !== userId && ctx.mitraUserId !== userId && role !== 'admin') {
    throw Object.assign(new Error('Anda tidak berhak melihat status pesanan ini.'), { status: 403 });
  }

  let effectiveStatus = resolveLocalPaymentStatus(ctx.trx.status, ctx.order.status, ctx.trx.gateway_response);

  if (ctx.trx.status === 'pending' && ctx.order.status === 'pending') {
    if (ctx.trx.gateway_order_id && getIsMidtransConfigured()) {
      effectiveStatus = await syncStatusFromMidtrans({
        id: ctx.trx.id,
        order_id: ctx.order.id,
        user_id: ctx.order.user_id,
        mitra_user_id: ctx.mitraUserId,
        total_amount: ctx.baseAmount,
        gateway_fee: ctx.trx.gateway_fee || ctx.platformFee,
        status: ctx.trx.status,
        gateway_order_id: ctx.trx.gateway_order_id,
      });
    }

    // Jika di Midtrans masih pending tapi batas waktu order lokal sudah lewat -> expire otomatis
    if (effectiveStatus === 'pending') {
      const exp = computeOrderDeadline(ctx.order.created_at, ctx.trx.expiry_time);
      if (exp.getTime() <= Date.now()) {
        if (ctx.trx.gateway_order_id && getIsMidtransConfigured()) {
          await cancelRemoteChargeIfAny(ctx.trx.gateway_order_id);
        }
        await expireOrder({
          id: ctx.trx.id,
          order_id: ctx.order.id,
          user_id: ctx.order.user_id,
          mitra_user_id: ctx.mitraUserId,
          total_amount: ctx.baseAmount,
        });
        effectiveStatus = 'expired';
      }
    }
  }

  const latestCtx = effectiveStatus !== resolveLocalPaymentStatus(ctx.trx.status, ctx.order.status, ctx.trx.gateway_response)
    ? await loadOrderContext(orderId)
    : ctx;
  const active = latestCtx ?? ctx;

  return {
    order_id: active.order.id,
    reference_code: active.referenceCode,
    gateway: active.trx.gateway || 'midtrans',
    gateway_order_id: active.trx.gateway_order_id,
    payment_method: active.trx.transaction_type,
    payment_type: active.trx.payment_type,
    payment_status: resolveLocalPaymentStatus(
      active.trx.status,
      active.order.status,
      active.trx.gateway_response
    ),
    order_status: active.order.status,
    base_amount: active.baseAmount,
    service_fee: active.trx.gateway_fee || active.platformFee,
    total_pay: active.baseAmount + (active.trx.gateway_fee || active.platformFee),
    expiry_time: toIsoWibString(computeOrderDeadline(active.order.created_at, active.trx.expiry_time)),
    paid_at: toIsoWibString(active.trx.paid_at),
  };
}

function resolveLocalPaymentStatus(
  txStatus: string,
  orderStatus: string,
  gatewayResponse: Record<string, any> | null
): 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled' {
  if (txStatus === 'success' || orderStatus === 'paid' || orderStatus === 'packed' || orderStatus === 'shipped' || orderStatus === 'completed') {
    return 'paid';
  }
  if (txStatus === 'cancelled') return 'cancelled';
  if (txStatus === 'failed') {
    if (
      gatewayResponse?.internal_reason === 'expired' ||
      gatewayResponse?.transaction_status === 'expire' ||
      gatewayResponse?.reason === 'expired'
    ) {
      return 'expired';
    }
    return 'failed';
  }
  if (orderStatus === 'cancelled') return 'cancelled';
  return 'pending';
}

/** Batalkan tagihan di Midtrans saja secara best-effort (dipakai juga saat order dibatalkan). */
export async function cancelRemoteChargeIfAny(gatewayOrderId: string | null | undefined): Promise<void> {
  if (!gatewayOrderId || !getIsMidtransConfigured()) return;
  try {
    await coreApi.transaction.cancel(gatewayOrderId);
  } catch (err: any) {
    console.warn('[Midtrans] cancel charge (best-effort):', err?.message || err);
  }
}

/** Batalkan charge di Midtrans + batalkan order lokal (stok kembali). */
export async function cancelOrderPayment(
  userId: number,
  role: string,
  orderId: number,
  reason = 'Dibatalkan oleh pembeli'
): Promise<Record<string, any>> {
  const ctx = await loadOrderContext(orderId);
  if (!ctx) throw Object.assign(new Error('Pesanan tidak ditemukan.'), { status: 404 });

  if (ctx.order.user_id !== userId && role !== 'admin') {
    throw Object.assign(new Error('Anda tidak berhak membatalkan pembayaran pesanan ini.'), { status: 403 });
  }
  if (ctx.order.status === 'paid' || ctx.trx.status === 'success') {
    throw Object.assign(new Error('Pesanan sudah dibayar dan tidak dapat dibatalkan.'), { status: 400 });
  }
  if (ctx.order.status === 'cancelled' || ctx.trx.status === 'cancelled') {
    return { order_id: orderId, payment_status: 'cancelled', order_status: 'cancelled' };
  }

  await cancelRemoteChargeIfAny(ctx.trx.gateway_order_id);
  await cancelOrExpireOrderPayment(
    {
      id: ctx.trx.id,
      order_id: ctx.order.id,
      user_id: ctx.order.user_id,
      mitra_user_id: ctx.mitraUserId,
      total_amount: ctx.baseAmount,
      status: ctx.trx.status,
    },
    'cancelled',
    { reason }
  );

  return {
    order_id: orderId,
    payment_status: 'cancelled',
    order_status: 'cancelled',
  };
}

/** Shortcut khusus Sandbox untuk demo/testing tanpa menunggu simulator. */
export async function simulateOrderPaid(
  userId: number,
  role: string,
  orderId: number
): Promise<Record<string, any>> {
  if (isMidtransProductionMode()) {
    throw Object.assign(
      new Error('Simulasi pembayaran hanya tersedia pada mode Sandbox.'),
      { status: 403 }
    );
  }

  const ctx = await loadOrderContext(orderId);
  if (!ctx) throw Object.assign(new Error('Pesanan tidak ditemukan.'), { status: 404 });

  if (ctx.order.user_id !== userId && role !== 'admin') {
    throw Object.assign(new Error('Anda tidak berhak mensimulasikan pembayaran ini.'), { status: 403 });
  }
  if (ctx.order.status === 'cancelled') {
    throw Object.assign(new Error('Pesanan sudah dibatalkan.'), { status: 400 });
  }

  const settled = await settleOrderPaid({
    id: ctx.trx.id,
    order_id: ctx.order.id,
    user_id: ctx.order.user_id,
    mitra_user_id: ctx.mitraUserId,
    total_amount: ctx.baseAmount,
    status: ctx.trx.status,
  });

  await pool.query(
    'UPDATE transactions SET paid_at = COALESCE(paid_at, NOW()), gateway_response = COALESCE(gateway_response, ?) WHERE id = ?',
    [JSON.stringify({ simulated: true, sandbox: true }), ctx.trx.id]
  );

  return {
    order_id: orderId,
    payment_status: 'paid',
    order_status: 'paid',
    settled_now: settled,
  };
}
