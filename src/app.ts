// ============================================================
//  src/app.ts
//  Konfigurasi Express Application & Global Middleware
// ============================================================

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
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
// -------------------------------------------------------
app.use(
  cors({
    origin: (_origin, callback) => {
      // Izinkan request tanpa origin (seperti aplikasi native Flutter, Postman, emulator)
      // serta origin browser web frontend
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  })
);

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
