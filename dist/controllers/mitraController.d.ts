import { Request, Response } from 'express';
export declare const getDashboardMitra: (req: Request, res: Response) => Promise<void>;
export declare const getFinanceReport: (req: Request, res: Response) => Promise<void>;
export declare const getOrders: (req: Request, res: Response) => Promise<void>;
export declare const updateProduct: (req: Request, res: Response) => Promise<void>;
export declare const getPublicMitraStores: (req: Request, res: Response) => Promise<void>;
export declare const getPublicMitraDetail: (req: Request, res: Response) => Promise<void>;
/**
 * GET /api/mitra/wallet
 * Ringkasan saldo + riwayat pengajuan penarikan.
 */
export declare const getMitraWallet: (req: Request, res: Response) => Promise<void>;
/**
 * POST /api/mitra/wallet/withdraw
 * Body: { amount, bank_name, account_number, account_name }
 */
export declare const requestMitraWithdrawal: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=mitraController.d.ts.map