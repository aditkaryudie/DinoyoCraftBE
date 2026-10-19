import { Request, Response, NextFunction } from 'express';
/**
 * auditLogger
 * Mencatat request ke tabel audit_logs setelah response dikirim.
 * Tidak memblokir request (menggunakan 'finish' event).
 */
export declare const auditLogger: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auditMiddleware.d.ts.map