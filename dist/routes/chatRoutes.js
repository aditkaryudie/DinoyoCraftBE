"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chatController_js_1 = require("../controllers/chatController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const router = (0, express_1.Router)();
// Semua rute chat memerlukan autentikasi login
router.use(authMiddleware_js_1.verifyToken);
// Mengambil daftar kontak percakapan
router.get('/contacts', chatController_js_1.getChatContacts);
// Mengambil pesan percakapan dengan target user tertentu
router.get('/messages/:targetUserId', chatController_js_1.getMessages);
// Mengirim pesan ke target user tertentu (mentrigger Pusher event)
router.post('/send/:targetUserId', chatController_js_1.sendMessage);
exports.default = router;
//# sourceMappingURL=chatRoutes.js.map