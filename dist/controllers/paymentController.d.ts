import { Request, Response } from 'express';
/** GET /api/payments/methods — Daftar metode Midtrans aktif & konfigurasi biaya layanan. */
export declare const getMethods: (_req: Request, res: Response) => Promise<void>;
/** POST /api/payments/create — Buat atau ambil ulang tagihan Midtrans untuk satu order. */
export declare const createOrderPayment: (req: Request, res: Response) => Promise<void>;
/** GET /api/payments/status/:orderId — Status pembayaran terkini (sinkron Midtrans bila pending). */
export declare const checkOrderStatus: (req: Request, res: Response) => Promise<void>;
/** POST /api/payments/cancel/:orderId — Batalkan tagihan Midtrans dan batalkan pesanan. */
export declare const cancelPayment: (req: Request, res: Response) => Promise<void>;
/** POST /api/payments/webhook — HTTP Notification dari Midtrans + verifikasi SHA512 signature_key. */
export declare const handleWebhook: (req: Request, res: Response) => Promise<void>;
/** POST /api/payments/simulate-paid/:orderId — Shortcut Sandbox only (otomatis mati di Production). */
export declare const simulatePayment: (req: Request, res: Response) => Promise<void>;
/** GET /api/payments/sandbox-simulator/:orderId — Redirect auto-POST ke Midtrans Simulator Sandbox (VA/QRIS). */
export declare const openSandboxSimulator: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=paymentController.d.ts.map