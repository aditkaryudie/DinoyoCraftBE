import 'dotenv/config';
// ============================================================
//  src/server.ts
//  Entry point — menjalankan server HTTP
// ============================================================

import app from './app.js';
import { testConnection } from './config/database.js';
import AiSetting from './models/AiSetting.js';
import { startPaymentPoller } from './services/paymentPoller.js';
import { ensureSystemLogsSchema, logSystemEvent } from './services/loggingService.js';

const PORT = process.env.PORT || 5000;

const startServer = async (): Promise<void> => {
  // Tes koneksi database sebelum server mulai menerima request
  await testConnection();

  // Pastikan tabel system_logs dan index siap (§9.2, §14.1)
  await ensureSystemLogsSchema();
  console.log('✅ System Logs table & indexes synced and ready.');

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

  // Background poller pembayaran Midtrans (cadangan sinkronisasi status + auto-expire).
  startPaymentPoller();

  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log('='.repeat(50));
    console.log(`🚀 DinoyoCraft API Server running`);
    console.log(`   Host     : 0.0.0.0 (Accessible from Mobile & Local Network)`);
    console.log(`   Port     : ${PORT}`);
    console.log(`   Env      : ${process.env['NODE_ENV'] ?? 'development'}`);
    console.log(`   Base URL : http://localhost:${PORT}/api`);
    console.log(`   Health   : http://localhost:${PORT}/health`);
    console.log('='.repeat(50));
  });

  server.on('error', (err: any) => {
    console.error('❌ Server HTTP error:', err);
  });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  console.error('⚠️ Unhandled Rejection:', reason);
  logSystemEvent({
    category: 'system',
    eventName: 'system.unhandled_rejection',
    severity: 'critical',
    outcome: 'failure',
    message: `Unhandled Promise Rejection: ${reason instanceof Error ? reason.message : String(reason)}`,
    source: 'backend',
    service: 'api-process',
    error: {
      code: 'UNHANDLED_REJECTION',
      name: reason instanceof Error ? reason.name : 'UnhandledRejection',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : null,
    },
  }).catch(() => {});
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('⚠️ Uncaught Exception:', err);
  logSystemEvent({
    category: 'system',
    eventName: 'system.uncaught_exception',
    severity: 'critical',
    outcome: 'failure',
    message: `Uncaught Exception: ${err.message}`,
    source: 'backend',
    service: 'api-process',
    error: {
      code: 'UNCAUGHT_EXCEPTION',
      name: err.name,
      message: err.message,
      stack: err.stack || null,
    },
  }).catch(() => {});
});

process.on('exit', (code: number) => {
  console.log(`🛑 Node process exited with code: ${code}`);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

startServer().catch((err: unknown) => {
  console.error('❌ Gagal menjalankan server:', err);
  process.exit(1);
});
