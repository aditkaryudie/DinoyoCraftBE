export interface PendingTransactionRow {
    id: number;
    order_id: number;
    user_id: number;
    mitra_user_id: number;
    total_amount: number;
    status: string;
}
/**
 * Tandai transaksi + pesanan sebagai 'paid'/'success', kirim notifikasi ke
 * mitra & pembeli, dan trigger Pusher. Idempoten: jika transaksi sudah
 * 'success', tidak melakukan apa-apa dan mengembalikan false.
 */
export declare function settleOrderPaid(trx: {
    id: number;
    order_id: number;
    user_id: number;
    mitra_user_id: number;
    total_amount: number;
    status?: string;
}): Promise<boolean>;
/**
 * Cari transaksi berdasarkan inv_id atau payment_token (dipakai webhook).
 */
export declare function findTransactionByRef(invId?: string, token?: string): Promise<PendingTransactionRow | null>;
//# sourceMappingURL=orderSettlement.d.ts.map