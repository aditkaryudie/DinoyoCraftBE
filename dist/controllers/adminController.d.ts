import { Request, Response } from 'express';
/**
 * GET /api/admin/dashboard-stats
 * Ringkasan statistik dan aktivitas dashboard admin
 */
export declare const getDashboardStats: (_req: Request, res: Response) => Promise<void>;
/**
 * GET /api/admin/transactions
 * Daftar seluruh transaksi lintas toko (dari tabel orders & transactions)
 */
export declare const getAdminTransactions: (_req: Request, res: Response) => Promise<void>;
/**
 * GET /api/admin/users
 */
export declare const getAllUsers: (req: Request, res: Response) => Promise<void>;
/**
 * POST /api/admin/users
 */
export declare const createUser: (req: Request, res: Response) => Promise<void>;
/**
 * PUT /api/admin/users/:id
 */
export declare const updateUser: (req: Request, res: Response) => Promise<void>;
/**
 * DELETE /api/admin/users/:id
 */
export declare const deleteUser: (req: Request, res: Response) => Promise<void>;
/**
 * PATCH /api/admin/users/:id/status
 */
export declare const updateUserStatus: (req: Request, res: Response) => Promise<void>;
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
 * Mendapatkan daftar semua pengajuan verifikasi & manajemen toko mitra
 */
export declare const getVerifikasiList: (_req: Request, res: Response) => Promise<void>;
/**
 * PATCH /api/admin/verifikasi/:id
 * Setujui ('approved') atau tolak ('rejected') verifikasi toko mitra
 */
export declare const verifyMitraStore: (req: Request, res: Response) => Promise<void>;
/**
 * PATCH /api/admin/stores/:id/status
 * Aktifkan / suspend toko mitra
 */
export declare const updateStoreStatus: (req: Request, res: Response) => Promise<void>;
/**
 * DELETE /api/admin/stores/:id
 */
export declare const deleteStore: (req: Request, res: Response) => Promise<void>;
/**
 * GET /api/admin/categories
 */
export declare const getCategories: (_req: Request, res: Response) => Promise<void>;
/**
 * POST /api/admin/categories
 */
export declare const createCategory: (req: Request, res: Response) => Promise<void>;
/**
 * PUT /api/admin/categories/:id
 */
export declare const updateCategory: (req: Request, res: Response) => Promise<void>;
/**
 * DELETE /api/admin/categories/:id
 */
export declare const deleteCategory: (req: Request, res: Response) => Promise<void>;
/**
 * GET /api/admin/schedules
 * Menggunakan tabel educational_tours
 */
export declare const getSchedules: (_req: Request, res: Response) => Promise<void>;
/**
 * POST /api/admin/schedules
 */
export declare const createSchedule: (req: Request, res: Response) => Promise<void>;
/**
 * PUT /api/admin/schedules/:id
 */
export declare const updateSchedule: (req: Request, res: Response) => Promise<void>;
/**
 * DELETE /api/admin/schedules/:id
 */
export declare const deleteSchedule: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=adminController.d.ts.map