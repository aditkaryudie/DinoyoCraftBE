"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const moderationController_js_1 = require("../controllers/moderationController.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const router = express_1.default.Router();
// Middleware: Hanya admin yang bisa mengakses rute ini
router.use(authMiddleware_js_1.verifyToken, authMiddleware_js_1.isAdmin);
// Tab 1: Laporan Pelanggaran
router.get('/reports', moderationController_js_1.getReports);
router.put('/reports/:id/action', moderationController_js_1.handleReportAction);
// Tab 2: Pengajuan Hapus Akun
router.get('/account-deletions', moderationController_js_1.getDeletionRequests);
router.put('/account-deletions/:id/action', moderationController_js_1.handleDeletionAction);
exports.default = router;
//# sourceMappingURL=moderationRoutes.js.map