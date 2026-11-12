import 'dotenv/config';
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
import path from 'path';

// Load environment variables SEBELUM apapun
dotenv.config();

const app: Application = express();

// -------------------------------------------------------
// 1. CORS — Konfigurasi origin ramah Mobile & Web
// Tambahkan ini agar aplikasi web (Chrome) diizinkan mengakses API
// -------------------------------------------------------
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// 2. Keamanan — Helmet & Rate Limiter
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
  // Kecualikan webhook Midtrans agar callback server-to-server tidak pernah kena rate limit (PRD §5.4)
  skip: (req) =>
    req.path === '/payments/webhook' || req.originalUrl.startsWith('/api/payments/webhook'),
  message: {
    success: false,
    message: 'Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit.',
  },
});
app.use('/api', apiLimiter);

// -------------------------------------------------------
// 3. Body Parsing
// -------------------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// -------------------------------------------------------
// 4. Keamanan — Header dasar
// -------------------------------------------------------
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.removeHeader('X-Powered-By');
  next();
});

// -------------------------------------------------------
// 5. Audit Logger (non-blocking)
// -------------------------------------------------------
app.use(auditLogger);

// -------------------------------------------------------
// 6. Health Check — sebelum router utama
// -------------------------------------------------------
app.get(['/health', '/api/health'], (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'DinoyoCraft API is running 🚀',
    timestamp: new Date().toISOString(),
    environment: process.env['NODE_ENV'] ?? 'development',
  });
});

// Kunci target folder baca agar PERSIS SAMA dengan Multer
const targetFolder = path.join(process.cwd(), 'uploads');
console.log('📂 Static Server membaca dari:', targetFolder);
app.use('/uploads', express.static(targetFolder));

// -------------------------------------------------------
// 7. Router Utama
// -------------------------------------------------------
app.use('/api', router);

// -------------------------------------------------------
// 8. 404 Handler — route tidak ditemukan
// -------------------------------------------------------
app.use(notFound);

// -------------------------------------------------------
// 9. Global Error Handler — HARUS paling terakhir
// -------------------------------------------------------
app.use(globalErrorHandler);

export default app;
