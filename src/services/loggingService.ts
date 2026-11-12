// ============================================================
//  src/services/loggingService.ts
//  Centralized System Logging, Masking, Route Classification & Pusher Stream
// ============================================================

import crypto from 'crypto';
import { Request, Response } from 'express';
import Pusher from 'pusher';
import pool from '../config/database.js';

export type LogSeverity = 'debug' | 'info' | 'success' | 'warning' | 'error' | 'critical';
export type LogOutcome = 'success' | 'failure' | 'pending' | 'info';
export type LogSource = 'backend' | 'web' | 'mobile' | 'worker' | 'external';

export type LogCategory =
  | 'auth'
  | 'transaction'
  | 'order'
  | 'product_store'
  | 'cart_address'
  | 'chat'
  | 'notification'
  | 'moderation'
  | 'ai'
  | 'external'
  | 'mobile'
  | 'system'
  | 'admin_audit';

export interface SystemLogEventInput {
  eventId?: string;
  occurredAt?: Date | string;
  category: LogCategory | string;
  eventName: string;
  severity: LogSeverity;
  outcome: LogOutcome;
  message: string;
  source?: LogSource;
  service?: string;
  http?: {
    method: string;
    route: string;
    statusCode: number;
    durationMs: number;
  };
  correlation?: {
    requestId?: string | null;
    traceId?: string | null;
    userId?: number | null;
    role?: string | null;
    orderId?: number | null;
    transactionId?: number | null;
    referenceCode?: string | null;
  };
  client?: {
    platform?: string | null;
    appVersion?: string | null;
    ipMasked?: string | null;
    userAgent?: string | null;
  };
  error?: {
    code?: string | null;
    name?: string | null;
    message?: string | null;
    stack?: string | null;
    providerCode?: string | null;
  };
  metadata?: Record<string, unknown> | null;
  skipPusher?: boolean;
}

// Inisialisasi Pusher untuk Live Logs Admin
let pusherClient: Pusher | null = null;
export const getPusherClient = (): Pusher | null => {
  if (pusherClient) return pusherClient;
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY || process.env.PUSHER_APP_KEY;
  const secret = process.env.PUSHER_SECRET || process.env.PUSHER_APP_SECRET;
  const cluster = process.env.PUSHER_CLUSTER || 'ap1';

  if (!appId || !key || !secret) return null;
  try {
    pusherClient = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });
    return pusherClient;
  } catch {
    return null;
  }
};

// Pembuat Event ID yang unik dan berurutan berdasarkan waktu (ULID-like)
export const generateEventId = (): string => {
  const ts = Date.now().toString(36).padStart(9, '0').toUpperCase();
  const rand = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `EVT_${ts}_${rand}`;
};

export const generateRequestId = (): string => {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(5).toString('hex');
  return `req_${ts}_${rand}`;
};

// ------------------------------------------------------------
//  Masking & Sanitasi Data Sensitif (§9.3)
// ------------------------------------------------------------
const SENSITIVE_KEY_PATTERN =
  /password|pass|pwd|otp|token|secret|authorization|cookie|api_key|apikey|signature|server_key|client_key|fcm_token|fcmtoken|cvv|card_number|va_number|full_address|ktp|nib|prompt|system_prompt/i;

export const maskEmail = (email?: string | null): string => {
  if (!email || typeof email !== 'string') return '-';
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) return '***';
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
};

export const maskPhone = (phone?: string | null): string => {
  if (!phone || typeof phone !== 'string') return '-';
  const digits = phone.replace(/\s+/g, '');
  if (digits.length <= 6) return '***';
  return `${digits.slice(0, 4)}****${digits.slice(-3)}`;
};

export const maskIp = (ip?: string | null): string => {
  if (!ip || typeof ip !== 'string') return 'unknown';
  const clean = ip.replace('::ffff:', '').trim();
  if (clean === '::1' || clean === '127.0.0.1') return '127.0.0.***';
  const ipv4Parts = clean.split('.');
  if (ipv4Parts.length === 4) {
    return `${ipv4Parts[0]}.${ipv4Parts[1]}.${ipv4Parts[2]}.***`;
  }
  const ipv6Parts = clean.split(':');
  if (ipv6Parts.length > 2) {
    return `${ipv6Parts.slice(0, 3).join(':')}:****`;
  }
  return 'masked_ip';
};

export const sanitizeStack = (stack?: string | null): string | null => {
  if (!stack || typeof stack !== 'string') return null;
  return stack
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/(password|secret|token|key)\s*[:=]\s*['"]?[^'"\s]+['"]?/gi, '$1=[REDACTED]')
    .slice(0, 3500);
};

export const sanitizeText = (text?: string | null): string => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/([a-zA-Z0-9._%+-]{2})[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1***@$2')
    .slice(0, 1000);
};

export const sanitizeMetadata = (
  input: unknown,
  depth = 0
): Record<string, unknown> | null => {
  if (!input || typeof input !== 'object' || depth > 3) return null;
  const output: Record<string, unknown> = {};
  const entries = Object.entries(input as Record<string, unknown>).slice(0, 30);

  for (const [key, val] of entries) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = '[REDACTED]';
      continue;
    }
    if (val === null || val === undefined) {
      output[key] = null;
    } else if (key.toLowerCase().includes('email') && typeof val === 'string') {
      output[key] = maskEmail(val);
    } else if (key.toLowerCase().includes('phone') && typeof val === 'string') {
      output[key] = maskPhone(val);
    } else if (key.toLowerCase().includes('ip') && typeof val === 'string') {
      output[key] = maskIp(val);
    } else if (typeof val === 'string') {
      output[key] = sanitizeText(val).slice(0, 300);
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      output[key] = val;
    } else if (Array.isArray(val)) {
      output[key] = val.slice(0, 10).map((item) =>
        typeof item === 'object' ? sanitizeMetadata(item, depth + 1) : String(item).slice(0, 120)
      );
    } else if (typeof val === 'object') {
      output[key] = sanitizeMetadata(val, depth + 1);
    }
  }
  return output;
};

// ------------------------------------------------------------
//  Normalisasi Route Template & Klasifikasi Kategori (§6, §10.1, §12)
// ------------------------------------------------------------
export const normalizeRouteTemplate = (rawUrl: string): string => {
  const withoutQuery = (rawUrl || '/').split('?')[0] || '/';
  return withoutQuery
    .replace(/\/EVT_[A-Za-z0-9_]+/g, '/:eventId')
    .replace(/\/ORD-[A-Za-z0-9-]+/g, '/:orderCode')
    .replace(/\/TRX-[A-Za-z0-9-]+/g, '/:txCode')
    .replace(/\/SCH-[A-Za-z0-9-]+/g, '/:scheduleId')
    .replace(/\/\d+(?=\/|$)/g, '/:id');
};

export const classifyRouteCategory = (routeTemplate: string): LogCategory => {
  const p = routeTemplate.toLowerCase();
  if (p.startsWith('/api/internal/logs/mobile')) return 'mobile';
  if (p.startsWith('/api/admin/logs')) return 'admin_audit';
  if (p.startsWith('/api/auth')) return 'auth';
  if (p.startsWith('/api/payments') || p.includes('/wallet') || p.includes('/transactions')) {
    return 'transaction';
  }
  if (p.startsWith('/api/orders') || p.includes('/mitra/orders')) return 'order';
  if (
    p.startsWith('/api/products') ||
    p.includes('/mitra/products') ||
    p.startsWith('/api/mitra/public') ||
    p.includes('/admin/verifikasi') ||
    p.includes('/admin/stores') ||
    p.includes('/admin/categories') ||
    p.includes('/admin/schedules')
  ) {
    return 'product_store';
  }
  if (p.startsWith('/api/cart') || p.startsWith('/api/addresses')) return 'cart_address';
  if (p.startsWith('/api/chat')) return 'chat';
  if (p.startsWith('/api/notifications') || p.includes('/fcm-token') || p.includes('/mitra/notifications')) {
    return 'notification';
  }
  if (p.includes('/moderation')) return 'moderation';
  if (p.startsWith('/api/ai') || p.includes('/ai-settings')) return 'ai';
  if (p.startsWith('/api/admin/users')) return 'admin_audit';
  return 'system';
};

export const deriveHttpStatusReason = (statusCode: number): string => {
  if (statusCode === 400) return 'Bad Request / Validasi Input';
  if (statusCode === 401) return 'Unauthorized / Sesi Tidak Valid';
  if (statusCode === 403) return 'Forbidden / Akses Ditolak';
  if (statusCode === 404) return 'Not Found / Rute Tidak Ditemukan';
  if (statusCode === 422) return 'Unprocessable Entity / Data Tidak Valid';
  if (statusCode === 429) return 'Too Many Requests / Rate Limit';
  if (statusCode >= 500) return 'Internal Server Error';
  return 'OK';
};

export const computeRetentionExpiry = (severity: LogSeverity, fromDate = new Date()): Date => {
  const daysMap: Record<LogSeverity, number> = {
    debug: 7,
    info: 30,
    success: 30,
    warning: 90,
    error: 180,
    critical: 180,
  };
  const days = daysMap[severity] ?? 30;
  return new Date(fromDate.getTime() + days * 24 * 60 * 60 * 1000);
};

// ------------------------------------------------------------
//  Inisialisasi Skema Tabel system_logs & Seed Data Awal (§9.2, §14.1)
// ------------------------------------------------------------
export const ensureSystemLogsSchema = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`system_logs\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`event_id\` VARCHAR(40) NOT NULL,
      \`occurred_at\` DATETIME(3) NOT NULL,
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`category\` VARCHAR(50) NOT NULL,
      \`event_name\` VARCHAR(120) NOT NULL,
      \`severity\` VARCHAR(20) NOT NULL,
      \`outcome\` VARCHAR(20) NOT NULL DEFAULT 'info',
      \`source\` VARCHAR(30) NOT NULL DEFAULT 'backend',
      \`service\` VARCHAR(60) NOT NULL DEFAULT 'api',
      \`http_method\` VARCHAR(16) DEFAULT NULL,
      \`route_template\` VARCHAR(255) DEFAULT NULL,
      \`status_code\` INT DEFAULT NULL,
      \`duration_ms\` INT DEFAULT NULL,
      \`request_id\` VARCHAR(64) DEFAULT NULL,
      \`trace_id\` VARCHAR(64) DEFAULT NULL,
      \`user_id\` INT DEFAULT NULL,
      \`role\` VARCHAR(30) DEFAULT NULL,
      \`order_id\` INT DEFAULT NULL,
      \`transaction_id\` INT DEFAULT NULL,
      \`reference_code\` VARCHAR(100) DEFAULT NULL,
      \`message\` TEXT NOT NULL,
      \`error_code\` VARCHAR(80) DEFAULT NULL,
      \`error_name\` VARCHAR(120) DEFAULT NULL,
      \`error_message\` TEXT DEFAULT NULL,
      \`error_stack\` TEXT DEFAULT NULL,
      \`metadata_json\` JSON DEFAULT NULL,
      \`ip_masked\` VARCHAR(64) DEFAULT NULL,
      \`user_agent\` VARCHAR(500) DEFAULT NULL,
      \`platform\` VARCHAR(50) DEFAULT NULL,
      \`app_version\` VARCHAR(50) DEFAULT NULL,
      \`acknowledged_at\` DATETIME DEFAULT NULL,
      \`acknowledged_by\` INT DEFAULT NULL,
      \`deleted_at\` DATETIME DEFAULT NULL,
      \`deleted_by\` INT DEFAULT NULL,
      \`delete_reason\` VARCHAR(255) DEFAULT NULL,
      \`retention_expires_at\` DATETIME DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_system_logs_event_id\` (\`event_id\`),
      KEY \`idx_system_logs_occurred_at\` (\`occurred_at\`, \`id\`),
      KEY \`idx_system_logs_category_occurred\` (\`category\`, \`occurred_at\`),
      KEY \`idx_system_logs_severity_occurred\` (\`severity\`, \`occurred_at\`),
      KEY \`idx_system_logs_request_id\` (\`request_id\`),
      KEY \`idx_system_logs_user_occurred\` (\`user_id\`, \`occurred_at\`),
      KEY \`idx_system_logs_order_id\` (\`order_id\`),
      KEY \`idx_system_logs_transaction_id\` (\`transaction_id\`),
      KEY \`idx_system_logs_status_occurred\` (\`status_code\`, \`occurred_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Seed data awal yang representatif jika tabel masih kosong agar Admin langsung dapat menguji seluruh filter & korelasi
  const [countRows]: any = await pool.query('SELECT COUNT(*) AS total FROM system_logs');
  const total = Number(countRows?.[0]?.total || 0);
  if (total === 0) {
    await seedInitialSystemLogs();
  }
};

const seedInitialSystemLogs = async (): Promise<void> => {
  const now = Date.now();
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;

  const samples: Array<SystemLogEventInput & { offsetMs: number }> = [
    {
      offsetMs: -2 * min,
      category: 'auth',
      eventName: 'auth.login.succeeded',
      severity: 'success',
      outcome: 'success',
      message: 'Login berhasil untuk akun Admin (ad***@dinoyocraft.com)',
      source: 'backend',
      service: 'api',
      http: { method: 'POST', route: '/api/auth/login', statusCode: 200, durationMs: 84 },
      correlation: { requestId: 'req_demo_auth_01', userId: 1, role: 'admin' },
      client: { platform: 'Web Admin', ipMasked: '127.0.0.***', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      metadata: { email: 'admin@dinoyocraft.com', authMethod: 'password' },
    },
    {
      offsetMs: -5 * min,
      category: 'auth',
      eventName: 'auth.login.failed',
      severity: 'warning',
      outcome: 'failure',
      message: 'Percobaan login gagal: Kredensial salah (invalid_credentials) untuk bu***@gmail.com',
      source: 'backend',
      service: 'api',
      http: { method: 'POST', route: '/api/auth/login', statusCode: 401, durationMs: 62 },
      correlation: { requestId: 'req_demo_auth_02', role: 'guest' },
      client: { platform: 'Mobile Android', appVersion: '1.0.0', ipMasked: '192.168.1.***', userAgent: 'Dart/3.3 (flutter)' },
      error: { code: 'INVALID_CREDENTIALS', name: 'AuthError', message: 'Email atau kata sandi tidak sesuai.' },
      metadata: { reason: 'invalid_credentials', email: 'budi@gmail.com' },
    },
    {
      offsetMs: -8 * min,
      category: 'transaction',
      eventName: 'transaction.checkout.created',
      severity: 'success',
      outcome: 'success',
      message: 'Checkout pesanan #8 berhasil dibuat (Total tagihan Rp 40.366)',
      source: 'backend',
      service: 'api',
      http: { method: 'POST', route: '/api/orders/checkout', statusCode: 201, durationMs: 145 },
      correlation: { requestId: 'req_demo_trx_01', traceId: 'trc_order_8', userId: 40, role: 'pengunjung', orderId: 8, transactionId: 8, referenceCode: 'TRX-2026-0008' },
      client: { platform: 'Mobile Android', appVersion: '1.0.0', ipMasked: '10.0.2.***' },
      metadata: { shippingMethod: 'JNE Reguler', paymentMethod: 'QRIS', baseAmount: 37222, serviceFee: 3144 },
    },
    {
      offsetMs: -7 * min,
      category: 'transaction',
      eventName: 'transaction.qris.generated',
      severity: 'success',
      outcome: 'success',
      message: 'QRIS Dinamis berhasil dibuat untuk pesanan #8 (Ref: TRX-2026-0008)',
      source: 'backend',
      service: 'payment-gateway',
      http: { method: 'POST', route: '/api/payments/create', statusCode: 200, durationMs: 312 },
      correlation: { requestId: 'req_demo_trx_02', traceId: 'trc_order_8', userId: 40, role: 'pengunjung', orderId: 8, transactionId: 8, referenceCode: 'TRX-2026-0008' },
      client: { platform: 'Mobile Android', appVersion: '1.0.0', ipMasked: '10.0.2.***' },
      metadata: { gateway: 'SociaBuzz QRIS', totalPay: 40366 },
    },
    {
      offsetMs: -6 * min,
      category: 'transaction',
      eventName: 'transaction.webhook.signature_mismatch',
      severity: 'critical',
      outcome: 'failure',
      message: 'CRITICAL: Signature webhook pembayaran tidak valid pada percobaan callback eksternal',
      source: 'external',
      service: 'payment-webhook',
      http: { method: 'POST', route: '/api/payments/webhook/sociabuzz', statusCode: 500, durationMs: 29 },
      correlation: { requestId: 'req_demo_Hook_99', orderId: 7, transactionId: 7, referenceCode: 'TRX-2026-0007' },
      client: { platform: 'Webhook', ipMasked: '103.28.14.***', userAgent: 'SociaBuzz-Webhook/1.0' },
      error: {
        code: 'WEBHOOK_SIGNATURE_INVALID',
        name: 'PaymentSecurityError',
        message: 'Signature header X-Callback-Token tidak cocok dengan WEBHOOK_SECRET.',
        stack: 'PaymentSecurityError: Signature header X-Callback-Token tidak cocok\n    at verifyWebhookSignature (src/controllers/paymentController.ts:44:15)\n    at handlePaymentWebhook (src/controllers/paymentController.ts:92:7)',
        providerCode: 'SB_403_SIG',
      },
      metadata: { gateway: 'sociabuzz', verification: 'rejected' },
    },
    {
      offsetMs: -4 * min,
      category: 'order',
      eventName: 'order.shipping.updated',
      severity: 'success',
      outcome: 'success',
      message: 'Mitra menginput nomor resi JNE63534236 untuk pesanan #8 (Status: shipped)',
      source: 'backend',
      service: 'api',
      http: { method: 'PATCH', route: '/api/mitra/orders/:id/shipping', statusCode: 200, durationMs: 96 },
      correlation: { requestId: 'req_demo_ord_03', traceId: 'trc_order_8', userId: 39, role: 'mitra', orderId: 8, transactionId: 8, referenceCode: 'TRX-2026-0008' },
      client: { platform: 'Web Mitra', ipMasked: '127.0.0.***' },
      metadata: { previousStatus: 'paid', newStatus: 'shipped', courier: 'JNE Reguler', trackingNumber: 'JNE63534236' },
    },
    {
      offsetMs: -11 * min,
      category: 'product_store',
      eventName: 'product.catalog.updated',
      severity: 'success',
      outcome: 'success',
      message: 'Mitra memperbarui stok & harga produk #2 (Vas Keramik Minimalis)',
      source: 'backend',
      service: 'api',
      http: { method: 'PUT', route: '/api/mitra/products/:id', statusCode: 200, durationMs: 74 },
      correlation: { requestId: 'req_demo_prd_01', userId: 39, role: 'mitra' },
      metadata: { productId: 2, updatedFields: ['price', 'stock'] },
    },
    {
      offsetMs: -14 * min,
      category: 'chat',
      eventName: 'chat.message.delivered',
      severity: 'info',
      outcome: 'success',
      message: 'Pesan chat terkirim dan dipublikasikan ke channel Pusher (konten dienkripsi & disamarkan)',
      source: 'backend',
      service: 'chat-pusher',
      http: { method: 'POST', route: '/api/chat/send/:id', statusCode: 201, durationMs: 128 },
      correlation: { requestId: 'req_demo_chat_01', userId: 40, role: 'pengunjung' },
      metadata: { channel: 'chat-channel', delivery: 'pusher_ok', contentRedacted: true },
    },
    {
      offsetMs: -18 * min,
      category: 'notification',
      eventName: 'notification.fcm.sent',
      severity: 'success',
      outcome: 'success',
      message: 'Push notification FCM berhasil dikirim ke User #40 (1 sukses, 0 gagal)',
      source: 'external',
      service: 'fcm-service',
      http: { method: 'POST', route: '/api/mitra/orders/:id/shipping', statusCode: 200, durationMs: 215 },
      correlation: { requestId: 'req_demo_fcm_01', traceId: 'trc_order_8', userId: 40, orderId: 8 },
      metadata: { fcmSuccessCount: 1, fcmFailureCount: 0, tokenRedacted: true },
    },
    {
      offsetMs: -25 * min,
      category: 'moderation',
      eventName: 'moderation.report.submitted',
      severity: 'warning',
      outcome: 'info',
      message: 'Laporan pelanggaran produk baru diterima dari pengguna (Target: Produk #2)',
      source: 'backend',
      service: 'api',
      http: { method: 'POST', route: '/api/moderation/report', statusCode: 201, durationMs: 58 },
      correlation: { requestId: 'req_demo_mod_01', userId: 40, role: 'pengunjung' },
      metadata: { targetType: 'product', targetId: 2 },
    },
    {
      offsetMs: -35 * min,
      category: 'ai',
      eventName: 'ai.claybot.completed',
      severity: 'success',
      outcome: 'success',
      message: 'Request asisten virtual ClayBot selesai (Model: gemini-1.5-pro, 840 ms)',
      source: 'external',
      service: 'gemini-ai',
      http: { method: 'POST', route: '/api/ai/chat', statusCode: 200, durationMs: 840 },
      correlation: { requestId: 'req_demo_ai_01', userId: 40, role: 'pengunjung' },
      metadata: { model: 'gemini-1.5-pro', promptRedacted: true },
    },
    {
      offsetMs: -9 * min,
      category: 'external',
      eventName: 'external.smtp.delivery_failed',
      severity: 'error',
      outcome: 'failure',
      message: 'Gagal mengirim email notifikasi OTP: Connection timeout ke сервер SMTP',
      source: 'external',
      service: 'nodemailer-smtp',
      http: { method: 'POST', route: '/api/auth/forgot-password', statusCode: 500, durationMs: 3012 },
      correlation: { requestId: 'req_demo_ext_01' },
      error: {
        code: 'ETIMEDOUT',
        name: 'SmtpConnectionError',
        message: 'Connection timeout while connecting to smtp.gmail.com:587',
        stack: 'SmtpConnectionError: Connection timeout while connecting to smtp.gmail.com:587\n    at sendOtpEmail (src/utils/emailService.ts:62:11)',
        providerCode: 'SMTP_554',
      },
      metadata: { provider: 'gmail-smtp', retryScheduled: true },
    },
    {
      offsetMs: -12 * min,
      category: 'mobile',
      eventName: 'mobile.network.host_fallback',
      severity: 'warning',
      outcome: 'info',
      message: 'Aplikasi Mobile beralih dari host 10.35.96.186:5000 ke fallback 10.0.2.2:5000 (SocketException)',
      source: 'mobile',
      service: 'mobile-android',
      http: { method: 'GET', route: '/api/products/public', statusCode: 0, durationMs: 2100 },
      correlation: { requestId: 'req_demo_mob_01', userId: 40, role: 'pengunjung' },
      client: { platform: 'Android 14', appVersion: '1.0.0+1', ipMasked: '10.0.2.***', userAgent: 'DinoyoCraftMobile/1.0.0' },
      metadata: { failedHost: '10.35.96.186:5000', activeHost: '10.0.2.2:5000', crashlyticsRef: 'cl_nonfatal_9821a' },
    },
    {
      offsetMs: -3 * day,
      category: 'system',
      eventName: 'system.route.not_found',
      severity: 'warning',
      outcome: 'failure',
      message: 'Route tidak ditemukan (404): GET /api/v1/legacy-catalog',
      source: 'backend',
      service: 'api',
      http: { method: 'GET', route: '/api/v1/legacy-catalog', statusCode: 404, durationMs: 5 },
      correlation: { requestId: 'req_demo_sys_404' },
      client: { platform: 'Web', ipMasked: '127.0.0.***' },
    },
    {
      offsetMs: -12 * day,
      category: 'transaction',
      eventName: 'transaction.poller.sync_completed',
      severity: 'info',
      outcome: 'success',
      message: 'Background payment poller memeriksa 4 transaksi pending (3 tetap pending, 1 expired)',
      source: 'worker',
      service: 'payment-poller',
      correlation: { requestId: 'req_demo_poller_12d' },
      metadata: { checkedCount: 4, expiredCount: 1 },
    },
  ];

  for (const item of samples) {
    await logSystemEvent({
      ...item,
      occurredAt: new Date(now + item.offsetMs),
      skipPusher: true,
    });
  }
};

// ------------------------------------------------------------
//  Fungsi Utama: logSystemEvent (Non-blocking & Best-effort) (§10.1, §11)
// ------------------------------------------------------------
export const logSystemEvent = async (input: SystemLogEventInput): Promise<string | null> => {
  try {
    const eventId = input.eventId || generateEventId();
    const occurredDate = input.occurredAt ? new Date(input.occurredAt) : new Date();
    const severity: LogSeverity = input.severity || 'info';
    const retentionExpiresAt = computeRetentionExpiry(severity, occurredDate);

    const safeMessage = sanitizeText(input.message || input.eventName);
    const safeMetadata = sanitizeMetadata(input.metadata);
    const safeStack = sanitizeStack(input.error?.stack);
    const safeErrorMessage = input.error?.message ? sanitizeText(input.error.message) : null;
    const safeIp = input.client?.ipMasked ? maskIp(input.client.ipMasked) : null;
    const routeTemplate = input.http?.route ? normalizeRouteTemplate(input.http.route) : null;

    await pool.query(
      `INSERT INTO system_logs (
        event_id, occurred_at, created_at, category, event_name, severity, outcome,
        source, service, http_method, route_template, status_code, duration_ms,
        request_id, trace_id, user_id, role, order_id, transaction_id, reference_code,
        message, error_code, error_name, error_message, error_stack, metadata_json,
        ip_masked, user_agent, platform, app_version, retention_expires_at
      ) VALUES (?, ?, NOW(3), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        occurredDate,
        input.category,
        input.eventName,
        severity,
        input.outcome || 'info',
        input.source || 'backend',
        input.service || 'api',
        input.http?.method || null,
        routeTemplate,
        input.http?.statusCode ?? null,
        input.http?.durationMs ?? null,
        input.correlation?.requestId || null,
        input.correlation?.traceId || null,
        input.correlation?.userId ?? null,
        input.correlation?.role || null,
        input.correlation?.orderId ?? null,
        input.correlation?.transactionId ?? null,
        input.correlation?.referenceCode || null,
        safeMessage,
        input.error?.code || input.error?.providerCode || null,
        input.error?.name || null,
        safeErrorMessage,
        safeStack,
        safeMetadata ? JSON.stringify(safeMetadata) : null,
        safeIp,
        input.client?.userAgent ? String(input.client.userAgent).slice(0, 500) : null,
        input.client?.platform || null,
        input.client?.appVersion || null,
        retentionExpiresAt,
      ]
    );

    // Broadcast real-time ke Pusher (tanpa stack trace atau rahasia) (§8.4, §11)
    if (!input.skipPusher) {
      const pusher = getPusherClient();
      if (pusher) {
        const streamPayload = {
          eventId,
          occurredAt: occurredDate.toISOString(),
          category: input.category,
          eventName: input.eventName,
          severity,
          outcome: input.outcome || 'info',
          message: safeMessage,
          source: input.source || 'backend',
          service: input.service || 'api',
          http: input.http
            ? {
                method: input.http.method,
                route: routeTemplate,
                statusCode: input.http.statusCode,
                durationMs: input.http.durationMs,
              }
            : undefined,
          correlation: {
            requestId: input.correlation?.requestId || null,
            traceId: input.correlation?.traceId || null,
            userId: input.correlation?.userId ?? null,
            role: input.correlation?.role || null,
            orderId: input.correlation?.orderId ?? null,
            transactionId: input.correlation?.transactionId ?? null,
            referenceCode: input.correlation?.referenceCode || null,
          },
          client: {
            platform: input.client?.platform || null,
            ipMasked: safeIp,
          },
          error: input.error
            ? {
                code: input.error.code || input.error.providerCode || null,
                name: input.error.name || null,
                message: safeErrorMessage,
              }
            : undefined,
        };

        Promise.all([
          pusher.trigger('private-admin-system-logs', 'system-log.created', streamPayload),
          pusher.trigger('admin-system-logs', 'system-log.created', streamPayload),
        ]).catch((pusherErr: any) => {
          // Catat kegagalan publish Pusher dengan skipPusher=true agar tidak terjadi infinite loop (§11)
          logSystemEvent({
            category: 'external',
            eventName: 'external.pusher.publish_failed',
            severity: 'warning',
            outcome: 'failure',
            message: `Gagal mempublikasikan event log ke Pusher: ${pusherErr?.message || 'Unknown error'}`,
            source: 'external',
            service: 'pusher',
            correlation: { requestId: input.correlation?.requestId || null },
            skipPusher: true,
          }).catch(() => {});
        });
      }
    }

    return eventId;
  } catch (err) {
    // Jangan pernah memblokir alur bisnis utama jika pencatatan log gagal (§3, §10.1, §15.16)
    console.warn('⚠️ [loggingService] Gagal mencatat system log:', err);
    return null;
  }
};

// ------------------------------------------------------------
//  Helper Pencatatan Otomatis Request/Response HTTP (§10.1)
// ------------------------------------------------------------
export const logHttpRequest = (
  req: Request,
  res: Response,
  durationMs: number
): void => {
  const rawPath = req.originalUrl || req.url || req.path || '/';
  const cleanPath = rawPath.split('?')[0] || '/';

  // Abaikan health check & endpoint polling daftar log admin agar tidak membanjiri stream
  if (cleanPath === '/health' || cleanPath === '/api/health') return;
  if (req.method === 'GET' && cleanPath.startsWith('/api/admin/logs') && !cleanPath.endsWith('/export')) {
    return;
  }

  const statusCode = res.statusCode || 200;
  const routeTemplate = normalizeRouteTemplate(cleanPath);
  const category = (res.locals['logCategory'] as LogCategory) || classifyRouteCategory(routeTemplate);

  let severity: LogSeverity = 'success';
  let outcome: LogOutcome = 'success';
  if (statusCode >= 500) {
    severity = res.locals['isCriticalError'] ? 'critical' : 'error';
    outcome = 'failure';
  } else if (statusCode >= 400) {
    severity = 'warning';
    outcome = 'failure';
  } else if (statusCode >= 300) {
    severity = 'info';
    outcome = 'info';
  }

  const userId =
    (req as any).user?.id ||
    (req as any).user?.userId ||
    (res.locals['userId'] as number | undefined) ||
    null;
  const role =
    (req as any).user?.role ||
    (res.locals['role'] as string | undefined) ||
    'guest';

  const ipRaw =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  const userAgent = (req.headers['user-agent'] as string) || 'unknown';
  const platform = userAgent.toLowerCase().includes('dart') || userAgent.toLowerCase().includes('flutter')
    ? 'Mobile Flutter'
    : userAgent.toLowerCase().includes('mozilla')
    ? 'Web Browser'
    : 'API Client';

  const loggedError = res.locals['loggedError'] as Error | undefined;
  const customEventName = res.locals['logEventName'] as string | undefined;
  const customMessage = res.locals['logMessage'] as string | undefined;

  const eventName =
    customEventName ||
    `${category}.${req.method.toLowerCase()}.${statusCode >= 400 ? 'failed' : 'completed'}`;

  const statusReason = deriveHttpStatusReason(statusCode);
  const defaultMessage =
    statusCode >= 400
      ? `${req.method} ${routeTemplate} gagal dengan HTTP ${statusCode} (${statusReason})${loggedError?.message ? `: ${loggedError.message}` : ''}`
      : `${req.method} ${routeTemplate} selesai (${statusCode}) dalam ${durationMs} ms`;

  logSystemEvent({
    category,
    eventName,
    severity,
    outcome,
    message: customMessage || defaultMessage,
    source: 'backend',
    service: 'api',
    http: {
      method: req.method,
      route: routeTemplate,
      statusCode,
      durationMs,
    },
    correlation: {
      requestId: (res.locals['requestId'] as string) || null,
      traceId: (res.locals['traceId'] as string) || null,
      userId: userId ? Number(userId) : null,
      role: String(role),
      orderId: res.locals['orderId'] ? Number(res.locals['orderId']) : null,
      transactionId: res.locals['transactionId'] ? Number(res.locals['transactionId']) : null,
      referenceCode: (res.locals['referenceCode'] as string) || null,
    },
    client: {
      platform,
      ipMasked: ipRaw,
      userAgent,
    },
    error:
      statusCode >= 400
        ? {
            code: (loggedError as any)?.code || `HTTP_${statusCode}`,
            name: loggedError?.name || statusReason,
            message: loggedError?.message || customMessage || statusReason,
            stack: statusCode >= 500 ? loggedError?.stack || null : null,
          }
        : undefined,
    metadata: (res.locals['logMetadata'] as Record<string, unknown>) || {
      statusReason,
    },
  }).catch(() => {});
};

