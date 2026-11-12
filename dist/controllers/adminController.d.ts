import { Request, Response } from 'express';
/**
 * GET /api/admin/dashboard-stats
 * Ringkasan statistik dan aktivitas dashboard admin
 */
export declare const getDashboardStats: (_req: Request, res: Response) => Promise<void>;
/**
 * GET /api/admin/users
 */
export declare const getAllUsers: (_req: Request, res: Response) => Promise<void>;
/**
 * PATCH /api/admin/users/:id/status
 */
export declare const updateUserStatus: (req: Request, res: Response) => Promise<void>;
/**
 * PATCH /api/admin/users/:id/force-logout
 * Menaikkan token_version → seluruh access & refresh token pengguna di
 * SEMUA perangkat langsung tidak berlaku (sesi diakhiri paksa).
 */
export declare const forceLogoutUser: (req: Request, res: Response) => Promise<void>;
/**
 * GET /api/admin/master-data
 */
export declare const getMasterData: (req: Request, res: Response) => Promise<void>;
/**
 * POST /api/admin/master-data
 */
export declare const createMasterData: (req: Request, res: Response) => Promise<void>;
/**
 * GET /api/admin/verifikasi
 * Mendapatkan daftar semua pengajuan verifikasi toko mitra
 */
export declare const getVerifikasiList: (_req: Request, res: Response) => Promise<void>;
/**
 * PATCH /api/admin/verifikasi/:id
 * Setujui ('approved') atau tolak ('rejected') verifikasi toko mitra
 */
export declare const verifyMitraStore: (req: Request, res: Response) => Promise<void>;
/**
 * GET /api/admin/withdrawals?status=pending
 */
export declare const getWithdrawals: (req: Request, res: Response) => Promise<void>;
/**
 * PATCH /api/admin/withdrawals/:id
 * Body: { action: 'approve' | 'reject', admin_note? }
 */
export declare const handleWithdrawalAction: (req: Request, res: Response) => Promise<void>;
/**
 * GET /api/admin/transactions?status=&q=&page=1&limit=50
 */
export declare const getAdminTransactions: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=adminController.d.ts.map