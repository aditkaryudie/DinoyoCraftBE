"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
// ============================================================
//  src/server.ts
//  Entry point — menjalankan server HTTP
// ============================================================
const app_js_1 = __importDefault(require("./app.js"));
const database_js_1 = require("./config/database.js");
const AiSetting_js_1 = __importDefault(require("./models/AiSetting.js"));
const paymentPoller_js_1 = require("./services/paymentPoller.js");
const PORT = process.env.PORT || 5000;
const startServer = async () => {
    // Tes koneksi database sebelum server mulai menerima request
    await (0, database_js_1.testConnection)();
    // Pastikan tabel ai_settings tersinkronisasi dan memiliki default row (ID = 1)
    await AiSetting_js_1.default.sync();
    await AiSetting_js_1.default.findOrCreate({
        where: { id: 1 },
        defaults: {
            is_auto_reply_active: false,
            model_name: 'gemini-1.5-pro',
            api_key: '',
            system_prompt: 'Anda adalah Asisten Virtual resmi dari Kampung Keramik Dinoyo. Tugas Anda adalah melayani pelanggan, memberikan info seputar harga dan jadwal bengkel, serta membantu proses pemesanan dengan ramah dan sopan.',
        },
    });
    console.log('✅ AI Settings table synced and ready.');
    // Background poller pembayaran Midtrans (cadangan sinkronisasi status + auto-expire).
    (0, paymentPoller_js_1.startPaymentPoller)();
    const server = app_js_1.default.listen(Number(PORT), '0.0.0.0', () => {
        console.log('='.repeat(50));
        console.log(`🚀 DinoyoCraft API Server running`);
        console.log(`   Host     : 0.0.0.0 (Accessible from Mobile & Local Network)`);
        console.log(`   Port     : ${PORT}`);
        console.log(`   Env      : ${process.env['NODE_ENV'] ?? 'development'}`);
        console.log(`   Base URL : http://localhost:${PORT}/api`);
        console.log(`   Health   : http://localhost:${PORT}/health`);
        console.log('='.repeat(50));
    });
    server.on('error', (err) => {
        console.error('❌ Server HTTP error:', err);
    });
};
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
    console.error('⚠️ Unhandled Rejection:', reason);
});
// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('⚠️ Uncaught Exception:', err);
});
process.on('exit', (code) => {
    console.log(`🛑 Node process exited with code: ${code}`);
});
process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});
startServer().catch((err) => {
    console.error('❌ Gagal menjalankan server:', err);
    process.exit(1);
});
//# sourceMappingURL=server.js.map