// ============================================================
//  src/server.ts
//  Entry point — menjalankan server HTTP
// ============================================================

import app from './app.js';
import cors from 'cors';
import { testConnection } from './config/database.js';

const PORT = parseInt(process.env['PORT'] ?? '5000', 10);

const startServer = async (): Promise<void> => {
  // Tes koneksi database sebelum server mulai menerima request
  await testConnection();

  app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`🚀 DinoyoCraft API Server running`);
    console.log(`   Port     : ${PORT}`);
    console.log(`   Env      : ${process.env['NODE_ENV'] ?? 'development'}`);
    console.log(`   Base URL : http://localhost:${PORT}/api`);
    console.log(`   Health   : http://localhost:${PORT}/health`);
    console.log('='.repeat(50));
  });
};

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

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


