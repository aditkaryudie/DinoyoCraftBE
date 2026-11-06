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
const AiSetting_js_1 = __importDefault(require("./models/AiSetting.js"));
const MitraProfile_js_1 = require("./models/MitraProfile.js");
const PORT = process.env.PORT || 5000;
const startServer = async () => {
    // Tes koneksi database sebelum server mulai menerima request
    await (0, database_js_1.testConnection)();
    // Pastikan skema tabel mitra_profiles konsisten dengan model & query controller
    await (0, MitraProfile_js_1.ensureMitraProfileSchema)();
    console.log('✅ Mitra Profiles schema verified and ready.');
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
    app_js_1.default.listen(Number(PORT), '0.0.0.0', () => {
        console.log('='.repeat(50));
        console.log(`🚀 DinoyoCraft API Server running`);
        console.log(`   Host     : 0.0.0.0 (Accessible from Mobile & Local Network)`);
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