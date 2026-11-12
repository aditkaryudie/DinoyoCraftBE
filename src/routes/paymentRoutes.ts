// ============================================================
//  src/routes/paymentRoutes.ts
//  Router Pembayaran Midtrans Sandbox (PRD_Midtrans_Sandbox §5.2)
// ============================================================

import { Router } from 'express';
import {
  cancelPayment,
  checkOrderStatus,
  createOrderPayment,
  getMethods,
  handleWebhook,
  openSandboxSimulator,
  simulatePayment,
} from '../controllers/paymentController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { validateZod } from '../middlewares/validatorMiddleware.js';
import { createPaymentSchema } from '../validators/schemas.js';

const router = Router();

// Publik: daftar metode & biaya layanan aktif dari konfigurasi env
router.get('/methods', getMethods);

// Publik + verifikasi SHA512 signature_key dari Midtrans
router.post('/webhook', handleWebhook);

// Publik Sandbox only + verifikasi HMAC signature (untuk redirect external browser VA/QRIS)
router.get('/sandbox-simulator/:orderId', openSandboxSimulator);

// Terproteksi JWT: buat/ambil charge, cek status, batal, dan shortcut sandbox
router.post('/create', verifyToken, validateZod(createPaymentSchema), createOrderPayment);
router.get('/status/:orderId', verifyToken, checkOrderStatus);
router.post('/cancel/:orderId', verifyToken, cancelPayment);
router.post('/simulate-paid/:orderId', verifyToken, simulatePayment);

export default router;
