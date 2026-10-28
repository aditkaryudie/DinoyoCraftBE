"use strict";
// ============================================================
//  src/routes/chatRoutes.ts
//  Router Live Chat Terenkripsi & Pusher Realtime
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chatController_js_1 = require("../controllers/chatController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const validatorMiddleware_js_1 = require("../middlewares/validatorMiddleware.js");
const schemas_js_1 = require("../validators/schemas.js");
const router = (0, express_1.Router)();
router.use(authMiddleware_js_1.verifyToken);
router.get('/contacts', chatController_js_1.getChatContacts);
router.get('/messages/:targetUserId', chatController_js_1.getMessages);
router.post('/send/:targetUserId', (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.sendMessageSchema), chatController_js_1.sendMessage);
exports.default = router;
//# sourceMappingURL=chatRoutes.js.map