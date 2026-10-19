import { Request, Response, NextFunction } from 'express';
/**
 * notFound
 * Handler untuk route yang tidak ditemukan (404)
 */
export declare const notFound: (req: Request, res: Response) => void;
/**
 * globalErrorHandler
 * Harus menjadi middleware TERAKHIR yang didaftarkan di app.ts
 */
export declare const globalErrorHandler: (err: Error, _req: Request, res: Response, _next: NextFunction) => void;
//# sourceMappingURL=errorMiddleware.d.ts.map