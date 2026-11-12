import { Request, Response, NextFunction } from 'express';
/**
 * requestIdMiddleware (§10.1)
 * Membaca X-Request-ID atau membuat ID korelasi baru dan menyertakannya pada header respons.
 */
export declare const requestIdMiddleware: (req: Request, res: Response, next: NextFunction) => void;
/**
 * auditLogger
 * Mencatat request ke tabel audit_logs (kompatibilitas legacy) dan system_logs (observability terstruktur)
 * setelah response dikirim tanpa memblokir request (menggunakan 'finish' event).
 */
export declare const auditLogger: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auditMiddleware.d.ts.map