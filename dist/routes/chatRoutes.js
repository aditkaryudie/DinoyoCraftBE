"use strict";
// ============================================================
//  src/routes/chatRoutes.ts
//  Router Live Chat Terenkripsi & Pusher Realtime
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chatController_js_1 = require("../controllers/chatController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const validatorMiddleware_js_1 = require("../middlewares/validatorMiddleware.js");
const schemas_js_1 = require("../validators/schemas.js");
const uploadMiddleware_js_1 = __importDefault(require("../middlewares/uploadMiddleware.js"));
const router = (0, express_1.Router)();
router.use(authMiddleware_js_1.verifyToken);
router.get('/contacts', chatController_js_1.getChatContacts);
router.get('/unread-count', chatController_js_1.getUnreadChatCount);
router.post('/heartbeat', chatController_js_1.updateHeartbeat);
router.get('/messages/:targetUserId', chatController_js_1.getMessages);
router.patch('/messages/:targetUserId/read', chatController_js_1.markConversationAsRead);
router.post('/send/:targetUserId', uploadMiddleware_js_1.default.any(), (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.sendMessageSchema), chatController_js_1.sendMessage);
router.post('/send', uploadMiddleware_js_1.default.any(), (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.sendMessageSchema), chatController_js_1.sendMessage);
exports.default = router;
//# sourceMappingURL=chatRoutes.js.map