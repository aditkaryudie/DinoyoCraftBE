import { Router } from 'express';
import {
  getPaymentMethods,
  createPayment,
  getPaymentStatus,
  confirmPayment
} from '../controllers/paymentController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(verifyToken);

router.post('/methods', getPaymentMethods);
router.post('/create', createPayment);
router.get('/status/:orderId', getPaymentStatus);
router.post('/confirm/:orderId', confirmPayment);

export default router;
