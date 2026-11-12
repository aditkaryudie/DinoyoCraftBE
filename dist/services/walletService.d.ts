export declare const minWithdrawal: () => number;
export declare const withdrawalFee: () => number;
export interface WalletSummary {
    saldo_tersedia: number;
    pendapatan_tertunda: number;
    total_ditarik: number;
    min_withdrawal: number;
    withdrawal_fee: number;
}
/** Ringkasan saldo mitra berdasarkan pesanan selesai & riwayat penarikan. */
export declare function getWalletSummary(mitraId: number): Promise<WalletSummary>;
/**
 * Data grafik mingguan pendapatan mitra (7 hari terakhir).
 * Hasil query diagregasi per hari dan diparsing ke tipe Number asli
 * agar grafik frontend tidak datar akibat MySQL string casting pada SUM().
 */
export declare function getWeeklyChart(mitraId: number): Promise<any[]>;
/**
 * Data grafik bulanan pendapatan mitra (30 hari terakhir).
 * Hasil query diagregasi per hari dan diparsing ke tipe Number asli
 * agar grafik 30 hari di frontend tidak datar akibat MySQL string casting pada SUM().
 */
export declare function getMonthlyChart(mitraId: number): Promise<any[]>;
/**
 * Helper fleksibel untuk mengambil data grafik mitra berdasarkan rentang waktu ('7' atau '30').
 */
export declare function getMitraChart(mitraId: number, range?: '7' | '30' | string): Promise<any[]>;
/** Riwayat pengajuan penarikan milik mitra. */
export declare function listWithdrawals(mitraId: number, limit?: number): Promise<any>;
/** Ajukan penarikan saldo. Melempar Error dengan pesan Indonesia bila tidak valid. */
export declare function requestWithdrawal(userId: number, params: {
    amount: number;
    bank_name: string;
    account_number: string;
    account_name: string;
}): Promise<{
    id: number;
    amount: number;
    fee: number;
    status: string;
    bank_name: string;
    account_number: string;
    account_name: string;
}>;
/** Admin: daftar semua pengajuan (opsional filter status). */
export declare function adminListWithdrawals(status?: string, limit?: number): Promise<any>;
/** Admin: setujui / tolak pengajuan. Idempoten — status lama tidak dioverride. */
export declare function adminHandleWithdrawal(adminUserId: number, requestId: number, action: 'approve' | 'reject', adminNote?: string): Promise<{
    id: any;
    status: string;
    amount: number;
}>;
//# sourceMappingURL=walletService.d.ts.map