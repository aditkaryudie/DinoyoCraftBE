import { Router } from 'express';
import { createMidtransTransaction, handleMidtransNotification } from '../controllers/paymentController.js';

const router = Router();

// Karena di src/routes/index.ts sudah dipasang router.use('/payments', paymentRoutes),
// maka rute berikut akan langsung menjadi /api/payments/create-snap dan /api/payments/webhook
router.post('/create-snap', createMidtransTransaction);
router.post('/webhook', handleMidtransNotification);

// Alias untuk fleksibilitas jika diakses dengan path /payments/...
router.post('/payments/create-snap', createMidtransTransaction);
router.post('/payments/webhook', handleMidtransNotification);

export default router;
