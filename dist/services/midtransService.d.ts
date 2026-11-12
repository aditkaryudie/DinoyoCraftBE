export declare const midtransIsProduction: boolean;
export declare const isMidtransConfigured: boolean;
export declare const coreApi: import("midtrans-client").CoreApi;
export declare const snap: import("midtrans-client").Snap;
/**
 * Muat ulang key Midtrans bila file .env diedit tanpa restart server.
 */
export declare function reloadMidtransConfig(): void;
export declare function isMidtransProductionMode(): boolean;
export declare function getMidtransServerKey(): string;
export declare function getMidtransClientKey(): string;
export declare function getIsMidtransConfigured(): boolean;
export declare function assertMidtransConfigured(): void;
/** Ubah error mentah Midtrans SDK menjadi pesan yang jelas saat otorisasi gagal (401). */
export declare function formatMidtransChargeError(err: any): string;
/**
 * Verifikasi signature_key webhook:
 * Mendukung Signature Secret Key (MIDTRANS_SIGNATURE_KEY pada dashboard baru)
 * maupun Server Key (MIDTRANS_SERVER_KEY untuk kompatibilitas lama).
 */
export declare function verifySignatureKey(orderId: string, statusCode: string, grossAmount: string | number, signatureKey: string): boolean;
export type MidtransMappedStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled' | 'challenge';
/** Pemetaan status Midtrans → status DinoyoCraft (PRD §3.3). */
export declare function mapMidtransStatus(transactionStatus: string, fraudStatus?: string | null): MidtransMappedStatus;
/**
 * Biaya platform yang dibebankan ke pembeli.
 * Fee channel Midtrans (QRIS 0,7% / VA 4rb / GoPay 2%) DITANGGUNG PLATFORM
 * dan tidak dibebankan terpisah — sehingga nominal di app, BE, dan Midtrans
 * selalu sama (PRD §5.5).
 */
export declare function platformFeeFor(baseAmount: number): number;
/** Batas waktu bayar (menit) — dipakai untuk custom_expiry Midtrans. */
export declare function chargeExpiryMinutes(): number;
//# sourceMappingURL=midtransService.d.ts.map