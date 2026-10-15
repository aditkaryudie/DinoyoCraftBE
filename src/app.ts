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
import authRoutes from './routes/authRoutes';

// Load environment variables SEBELUM apapun
dotenv.config();

const app: Application = express();

// -------------------------------------------------------
// 1. CORS — Konfigurasi origin yang diizinkan
// -------------------------------------------------------
const allowedOrigins = (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Izinkan request tanpa origin (Postman, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin '${origin}' tidak diizinkan oleh CORS.`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Tambahkan di bawah blok konfigurasi CORS Anda
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.use('/api/auth', authRoutes);

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
