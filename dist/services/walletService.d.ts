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
/** Riwayat pengajuan penarikan milik mitra. */
export declare function listWithdrawals(mitraId: number, limit?: number): Promise<any>;
/** Ajukan penarikan saldo. Melempar Error dengan pesan Indonesia bila tidak valid. */
export declare function requestWithdrawal(userId: number, params: {
    amount: number;
    bank_name: string;
    account_number: string;
    account_name: string;
}): Promise<{
    id: any;
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