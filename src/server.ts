// ============================================================
//  src/server.ts
//  Entry point — menjalankan server HTTP
// ============================================================

import app from './app.js';
import { testConnection } from './config/database.js';
import AiSetting from './models/AiSetting.js';

const PORT = process.env.PORT || 5000;

const startServer = async (): Promise<void> => {
  // Tes koneksi database sebelum server mulai menerima request
  await testConnection();

  // Pastikan tabel ai_settings tersinkronisasi dan memiliki default row (ID = 1)
  await AiSetting.sync();
  await AiSetting.findOrCreate({
    where: { id: 1 },
    defaults: {
      is_auto_reply_active: false,
      model_name: 'gemini-1.5-pro',
      api_key: '',
      system_prompt:
        'Anda adalah Asisten Virtual resmi dari Kampung Keramik Dinoyo. Tugas Anda adalah melayani pelanggan, memberikan info seputar harga dan jadwal bengkel, serta membantu proses pemesanan dengan ramah dan sopan.',
    },
  });
  console.log('✅ AI Settings table synced and ready.');

  app.listen(Number(PORT), '0.0.0.0', () => {
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
process.on('unhandledRejection', (reason: unknown) => {
  console.error('🔥 Unhandled Rejection:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('🔥 Uncaught Exception:', err);
  process.exit(1);
});

startServer().catch((err: unknown) => {
  console.error('❌ Gagal menjalankan server:', err);
  process.exit(1);
});
