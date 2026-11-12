export interface PendingTransactionRow {
    id: number;
    order_id: number;
    user_id: number;
    mitra_user_id: number;
    total_amount: number;
    amount?: number;
    gateway_fee?: number;
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
 * Cari transaksi berdasarkan gateway_order_id (utama) atau payment_token.
 * Dipakai webhook Midtrans: order_id notifikasi = gateway_order_id kita.
 */
export declare function findTransactionByRef(gatewayOrderId?: string, token?: string): Promise<PendingTransactionRow | null>;
//# sourceMappingURL=orderSettlement.d.ts.map