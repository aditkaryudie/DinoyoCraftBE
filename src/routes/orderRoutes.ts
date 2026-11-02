import { Router } from 'express';
import {
  checkoutOrder,
  getOrders,
  getOrderDetail,
  updateOrderStatus
} from '../controllers/orderController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(verifyToken);

router.post('/checkout', checkoutOrder);
router.get('/', getOrders);
router.get('/:id', getOrderDetail);
router.patch('/:id/status', updateOrderStatus);

export default router;

