import { Router } from 'express';
import { sendMessage, getMessages, getChatContacts } from '../controllers/chatController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

// Semua rute chat memerlukan autentikasi login
router.use(verifyToken);

// Mengambil daftar kontak percakapan
router.get('/contacts', getChatContacts);

// Mengambil pesan percakapan dengan target user tertentu
router.get('/messages/:targetUserId', getMessages);

// Mengirim pesan ke target user tertentu (mentrigger Pusher event)
router.post('/send/:targetUserId', sendMessage);

export default router;
