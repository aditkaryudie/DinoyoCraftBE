export interface EnabledMethod {
    id: string;
    name: string;
    label: string;
    group: string;
    payment_type: string;
}
/** Daftar metode aktif dari env (GET /payments/methods). */
export declare function getEnabledMethods(): EnabledMethod[];
/** Info lengkap metode aktif + biaya layanan platform untuk Mobile/FE. */
export declare function getPaymentMethodsPayload(): {
    gateway: string;
    is_production: boolean;
    is_configured: boolean;
    service_fee_fixed: number;
    service_fee_percent: number;
    channel_fee: number;
    methods: EnabledMethod[];
};
/** Metode Midtrans valid = ada di env. */
export declare function isMethodEnabled(method: string): boolean;
/** Parse tanggal Midtrans ("YYYY-MM-DD HH:mm:ss" WIB / ISO) atau Date JS menjadi Date valid. */
export declare function parseGatewayDate(val: unknown): Date | null;
/** Konversi ke format MySQL DATETIME WIB (YYYY-MM-DD HH:mm:ss). */
export declare function toMysqlWibDatetime(val: unknown): string | null;
/** Format ISO-8601 WIB (+07:00) agar client Mobile akurat menghitung countdown. */
export declare function toIsoWibString(val: unknown): string | null;
/**
 * Hitung batas waktu pembayaran tetap untuk satu pesanan.
 * Selalu mengacu pada waktu pesanan pertama kali dibuat (created_at + durasi expiry)
 * agar tidak pernah reset ke 24 jam saat keluar/buka ulang atau ganti metode pembayaran.
 */
export declare function computeOrderDeadline(orderCreatedAt: unknown, existingExpiry?: unknown): Date;
export interface OrderPaymentContext {
    order: any;
    trx: any;
    items: Array<{
        product_id: number;
        name: string;
        price: number;
        quantity: number;
    }>;
    baseAmount: number;
    shippingCost: number;
    platformFee: number;
    grossAmount: number;
    customer: {
        name: string;
        email: string;
        phone: string;
    };
    referenceCode: string;
    mitraUserId: number;
}
/** Muat konteks lengkap satu order untuk pembayaran. */
export declare function loadOrderContext(orderId: number): Promise<OrderPaymentContext | null>;
/**
 * Buat atau ambil ulang charge Midtrans untuk satu order (idempoten).
 * Melempar Error ber-{status} bila validasi gagal.
 */
export declare function createOrUpdateCharge(userId: number, role: string, orderId: number, method: string): Promise<Record<string, any>>;
export declare function buildSandboxSimulatorPath(orderId: number, gatewayOrderId: string): string;
/**
 * Render halaman auto-submit POST menuju Midtrans Sandbox Simulator
 * agar VA & QRIS dapat dibayar satu klik seperti e-wallet pada mode Sandbox.
 */
export declare function getSandboxSimulatorPage(orderId: number, ref: string, sig: string): Promise<{
    status: number;
    html: string;
    redirectUrl?: string;
}>;
export type ResolvedPaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled';
/** Terapkan status Midtrans ke DB (dipakai webhook, polling, dan poller). */
export declare function applyMidtransStatus(trx: {
    id: number;
    order_id: number;
    user_id: number;
    mitra_user_id: number;
    total_amount: number;
    gateway_fee?: number;
    status: string;
}, transactionStatus: string, fraudStatus: string | null | undefined, grossAmount: string | number | undefined, raw?: any): Promise<ResolvedPaymentStatus>;
/** Tarik status terbaru dari Midtrans untuk satu transaksi pending. */
export declare function syncStatusFromMidtrans(trx: {
    id: number;
    order_id: number;
    user_id: number;
    mitra_user_id: number;
    total_amount: number;
    gateway_fee?: number;
    status: string;
    gateway_order_id: string | null;
}): Promise<ResolvedPaymentStatus>;
/** Cek & sinkronkan status pembayaran order untuk endpoint GET /payments/status/:orderId. */
export declare function checkAndSyncOrderPayment(userId: number, role: string, orderId: number): Promise<Record<string, any>>;
/** Batalkan tagihan di Midtrans saja secara best-effort (dipakai juga saat order dibatalkan). */
export declare function cancelRemoteChargeIfAny(gatewayOrderId: string | null | undefined): Promise<void>;
/** Batalkan charge di Midtrans + batalkan order lokal (stok kembali). */
export declare function cancelOrderPayment(userId: number, role: string, orderId: number, reason?: string): Promise<Record<string, any>>;
/** Shortcut khusus Sandbox untuk demo/testing tanpa menunggu simulator. */
export declare function simulateOrderPaid(userId: number, role: string, orderId: number): Promise<Record<string, any>>;
//# sourceMappingURL=paymentGatewayService.d.ts.map