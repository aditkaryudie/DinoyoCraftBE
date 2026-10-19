"use strict";
// ============================================================
//  src/server.ts
//  Entry point — menjalankan server HTTP
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_js_1 = __importDefault(require("./app.js"));
const database_js_1 = require("./config/database.js");
const PORT = process.env.PORT || 5000;
const startServer = async () => {
    // Tes koneksi database sebelum server mulai menerima request
    await (0, database_js_1.testConnection)();
    app_js_1.default.listen(PORT, () => {
        console.log('='.repeat(50));
        console.log(`🚀 DinoyoCraft API Server running`);
        console.log(`   Port     : ${PORT}`);
        console.log(`   Env      : ${process.env['NODE_ENV'] ?? 'development'}`);
        console.log(`   Base URL : http://localhost:${PORT}/api`);
        console.log(`   Health   : http://localhost:${PORT}/health`);
        console.log('='.repeat(50));
    });
};
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
    console.error('🔥 Unhandled Rejection:', reason);
    process.exit(1);
});
// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('🔥 Uncaught Exception:', err);
    process.exit(1);
});
startServer().catch((err) => {
    console.error('❌ Gagal menjalankan server:', err);
    process.exit(1);
});
//# sourceMappingURL=server.js.map