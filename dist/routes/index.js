"use strict";
// ============================================================
//  src/routes/index.ts
//  Central Router — mendaftarkan semua router modular
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authRoutes_js_1 = __importDefault(require("./authRoutes.js"));
const adminRoutes_js_1 = __importDefault(require("./adminRoutes.js"));
const aiRoutes_js_1 = __importDefault(require("./aiRoutes.js"));
const router = (0, express_1.Router)();
router.use('/auth', authRoutes_js_1.default);
router.use('/admin', adminRoutes_js_1.default);
router.use('/ai', aiRoutes_js_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map