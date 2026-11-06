import { Router } from 'express';
import {
  checkoutOrder,
  getOrders,
  getOrderDetail,
  getOrderTracking,
  cancelOrder,
  updateOrderStatus
} from '../controllers/orderController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(verifyToken);

router.post('/checkout', checkoutOrder);
router.get('/', getOrders);
router.get('/:id/tracking', getOrderTracking);
router.post('/:id/cancel', cancelOrder);
router.get('/:id', getOrderDetail);
router.patch('/:id/status', updateOrderStatus);

export default router;
