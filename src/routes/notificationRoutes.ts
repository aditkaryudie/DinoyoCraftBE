// ============================================================
//  src/routes/notificationRoutes.ts
//  Router Pusat Notifikasi
// ============================================================

import { Router } from 'express';
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../controllers/notificationController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

// Semua rute notifikasi wajib login
router.use(verifyToken);

router.get('/', getUserNotifications);
router.get('/unread-count', getUnreadNotificationCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

export default router;

