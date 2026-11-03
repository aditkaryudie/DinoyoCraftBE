// ============================================================
//  src/routes/paymentRoutes.ts
//  Router Payment Gateway (SociaBuzz via scbz sidecar)
// ============================================================

import { Router } from 'express';
import {
  getCountries,
  getFees,
  getMethods,
  createOrderPayment,
  checkOrderStatus,
  handleWebhook,
  simulatePayment,
} from '../controllers/paymentController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { validateZod } from '../middlewares/validatorMiddleware.js';
import {
  paymentFeesSchema,
  paymentMethodsSchema,
  createPaymentSchema,
} from '../validators/schemas.js';

const router = Router();

// 1. Publik: Ambil daftar negara yang didukung
router.get('/countries', getCountries);

// 2. Publik: Estimasi Fee / Biaya Transaksi
router.post('/fees', validateZod(paymentFeesSchema), getFees);

// 3. Webhook (Callback dari background dispatcher scbz)
router.post('/webhook', handleWebhook);

// ------------------------------------------------------------
// Rute di bawah ini wajib terautentikasi (Bearer Token JWT)
// ------------------------------------------------------------
router.use(verifyToken);

// 4. Ambil metode pembayaran yang aktif untuk sesi
router.post('/methods', validateZod(paymentMethodsSchema), getMethods);

// 5. Buat pembayaran untuk order (menghasilkan QRIS / URL)
router.post('/create', validateZod(createPaymentSchema), createOrderPayment);

// 6. Cek status pembayaran secara real-time untuk order
router.get('/status/:orderId', checkOrderStatus);

// 7. DEV/DEMO ONLY — simulasi pembayaran lunas tanpa uang asli
router.post('/simulate-paid/:orderId', simulatePayment);

export default router;

