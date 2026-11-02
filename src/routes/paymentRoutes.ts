import { Router } from 'express';
import {
  getPaymentMethods,
  createPayment,
  getPaymentStatus
} from '../controllers/paymentController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(verifyToken);

router.post('/methods', getPaymentMethods);
router.post('/create', createPayment);
router.get('/status/:orderId', getPaymentStatus);

export default router;

