import { Request, Response } from 'express';
/**
 * [GET] /api/admin/moderation/reports
 * Mengambil daftar laporan pelanggaran dengan filter Tipe, Status, dan Pencarian
 */
export declare const getReports: (req: Request, res: Response) => Promise<void>;
/**
 * [PUT] /api/admin/moderation/reports/:id/action
 * Mengeksekusi tindakan moderasi terhadap laporan (suspend toko/produk, hapus ulasan, atau abaikan)
 */
export declare const handleReportAction: (req: Request, res: Response) => Promise<void>;
/**
 * [GET] /api/admin/moderation/account-deletions
 * Mengambil daftar pengajuan penghapusan akun customer
 */
export declare const getDeletionRequests: (req: Request, res: Response) => Promise<void>;
/**
 * [PUT] /api/admin/moderation/account-deletions/:id/action
 * Setujui atau tolak pengajuan penghapusan akun
 */
export declare const handleDeletionAction: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=moderationController.d.ts.map