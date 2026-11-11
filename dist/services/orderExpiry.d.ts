export type OrderFailureReason = 'expired' | 'failed' | 'cancelled';
export interface OrderFailureTarget {
    id: number;
    order_id: number;
    user_id: number;
    mitra_user_id: number;
    total_amount: number;
    status?: string;
}
/**
 * Tandai transaksi pending sebagai gagal/expired/dibatalkan secara idempoten:
 * stok dikembalikan, order diubah ke 'cancelled', timeline & notifikasi dicatat.
 *
 * Catatan ENUM DB: kolom `transactions.status` hanya menerima
 * ('pending','success','failed','cancelled'), sehingga `expired` disimpan sebagai
 * `failed` dan detail `internal_reason: 'expired'` ikut dicatat pada `gateway_response`.
 */
export declare function cancelOrExpireOrderPayment(trx: OrderFailureTarget, reasonStatus: OrderFailureReason, raw?: unknown): Promise<boolean>;
/** Shortcut khusus untuk pesanan yang melewati batas waktu pembayaran. */
export declare function expireOrder(trx: OrderFailureTarget, raw?: unknown): Promise<boolean>;
//# sourceMappingURL=orderExpiry.d.ts.map