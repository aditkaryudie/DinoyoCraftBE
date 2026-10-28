// ============================================================
//  src/routes/chatRoutes.ts
//  Router Live Chat Terenkripsi & Pusher Realtime
// ============================================================

import { Router } from 'express';
import { sendMessage, getMessages, getChatContacts } from '../controllers/chatController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { validateZod } from '../middlewares/validatorMiddleware.js';
import { sendMessageSchema } from '../validators/schemas.js';

const router = Router();

router.use(verifyToken);

router.get('/contacts', getChatContacts);
router.get('/messages/:targetUserId', getMessages);
router.post('/send/:targetUserId', validateZod(sendMessageSchema), sendMessage);

export default router;
