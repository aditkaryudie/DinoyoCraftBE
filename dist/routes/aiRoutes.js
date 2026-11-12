"use strict";
// ============================================================
//  src/routes/aiRoutes.ts
//  Router Modular: AI Analisis — mitra & admin
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const aiController = __importStar(require("../controllers/aiController.js"));
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
const validatorMiddleware_js_1 = require("../middlewares/validatorMiddleware.js");
const schemas_js_1 = require("../validators/schemas.js");
const router = (0, express_1.Router)();
// Semua route AI memerlukan autentikasi
router.use(authMiddleware_js_1.verifyToken);
/**
 * @route   POST /api/ai/analyze
 * @desc    Menjalankan analisis AI untuk konteks bisnis keramik
 * @access  Protected (mitra & admin)
 */
router.post('/analyze', (0, authMiddleware_js_1.requireRole)(['mitra', 'admin']), (0, validatorMiddleware_js_1.validateZod)(schemas_js_1.aiAnalysisSchema), aiController.analyzeWithAI);
/**
 * @route   GET /api/ai/history
 * @desc    Riwayat analisis AI milik pengguna yang sedang login
 * @access  Protected (semua role)
 */
router.get('/history', aiController.getAiHistory);
exports.default = router;
//# sourceMappingURL=aiRoutes.js.map