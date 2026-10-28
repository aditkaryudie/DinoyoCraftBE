// ============================================================
//  src/app.ts
//  Konfigurasi Express Application & Global Middleware
// ============================================================

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import router from './routes/index.js';
import { notFound, globalErrorHandler } from './middlewares/errorMiddleware.js';
import { auditLogger } from './middlewares/auditMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import mitraRoutes from './routes/mitraRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import path from 'path';

// Load environment variables SEBELUM apapun
dotenv.config();

const app: Application = express();

// -------------------------------------------------------
// 1. CORS — Konfigurasi origin yang diizinkan
// -------------------------------------------------------
app.use(
  cors({
    origin: process.env['FRONTEND_URL'] || 'http://localhost:3000', // Wajib URL frontend secara spesifik
    credentials: true,                                              // Wajib true agar cookie/token bisa lewat
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 2. Keamanan — Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit.',
  },
});
app.use('/api', apiLimiter);



// -------------------------------------------------------
// 2. Body Parsing
// -------------------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// -------------------------------------------------------
// 3. Keamanan — Header dasar
// -------------------------------------------------------
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.removeHeader('X-Powered-By');
  next();
});

// -------------------------------------------------------
// 4. Audit Logger (non-blocking)
// -------------------------------------------------------
app.use(auditLogger);

// -------------------------------------------------------
// 5. Health Check — sebelum router utama
// -------------------------------------------------------
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'DinoyoCraft API is running 🚀',
    timestamp: new Date().toISOString(),
    environment: process.env['NODE_ENV'] ?? 'development',
  });
});

// 1. Kunci target folder baca agar PERSIS SAMA dengan Multer
const targetFolder = path.join(process.cwd(), 'uploads');

// 2. Tampilkan di terminal untuk memastikan tidak salah folder
console.log('📂 Static Server membaca dari:', targetFolder);

// 3. Pasang middleware statis (HARUS DI ATAS app.use('/api/...'))
app.use('/uploads', express.static(targetFolder));

// Rute Utama
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/mitra', mitraRoutes);
app.use('/api/chat', chatRoutes);

// -------------------------------------------------------
// 6. Router Utama
// -------------------------------------------------------
app.use('/api', router);

// -------------------------------------------------------
// 7. 404 Handler — route tidak ditemukan
// -------------------------------------------------------
app.use(notFound);

// -------------------------------------------------------
// 8. Global Error Handler — HARUS paling terakhir
// -------------------------------------------------------
app.use(globalErrorHandler);

export default app;
