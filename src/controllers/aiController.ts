// ============================================================
//  src/controllers/aiController.ts
//  Controller Analisis AI — integrasi Gemini API
//  dengan anonimisasi PII dan strict JSON schema
// ============================================================

import { Request, Response } from 'express';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import pool from '../config/database.js';
import { sendSuccess, sendError, sendBadRequest } from '../utils/response.js';
import {
  anonymizePII,
  anonymizeObject,
  detectSuspiciousInput,
} from '../utils/piiAnonymizer.js';
import { AiAnalysisDto, CountResult } from '../types/index.js';
import { getAuthLocals } from '../middlewares/authMiddleware.js';

// -------------------------------------------------------
// Inisialisasi Gemini Client
// -------------------------------------------------------
const GEMINI_API_KEY = process.env['GEMINI_API_KEY'];
const GEMINI_MODEL_NAME = process.env['GEMINI_MODEL'] ?? 'gemini-1.5-flash';

if (!GEMINI_API_KEY) {
  throw new Error('❌ GEMINI_API_KEY tidak ditemukan di environment variables!');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model: GenerativeModel = genAI.getGenerativeModel({
  model: GEMINI_MODEL_NAME,
  generationConfig: {
    temperature: 0.4,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json',
  },
});

// -------------------------------------------------------
// Tipe untuk hasil analisis AI
// -------------------------------------------------------
interface AiAnalysisResult {
  rekomendasi_produk: string[];
  analisis_pasar: string;
  strategi_pemasaran: string[];
  estimasi_harga: {
    min: number;
    max: number;
    satuan: string;
  };
  potensi_risiko: string[];
  kesimpulan: string;
  confidence_score: number;
}

// -------------------------------------------------------
// Prompt Engineering dengan Strict JSON Schema
// -------------------------------------------------------
const buildAnalysisPrompt = (
  context: string,
  productCategory: string,
  targetMarket: string,
  additionalNotes: string
): string => {
  return `
Kamu adalah AI konsultan bisnis keramik dan gerabah untuk UMKM di Kampung Dinoyo, Malang, Indonesia.

KONTEKS BISNIS:
${context}

KATEGORI PRODUK: ${productCategory}
TARGET PASAR: ${targetMarket}
CATATAN TAMBAHAN: ${additionalNotes}

TUGAS:
Berikan analisis bisnis yang komprehensif dan relevan untuk konteks UMKM keramik Dinoyo.

INSTRUKSI WAJIB:
1. Respons HARUS dalam format JSON yang valid.
2. Gunakan Bahasa Indonesia yang profesional dan mudah dipahami UMKM.
3. Semua rekomendasi harus SPESIFIK untuk bisnis keramik/gerabah.
4. Estimasi harga dalam Rupiah (IDR).
5. confidence_score adalah tingkat keyakinan analisismu (0-100).

FORMAT OUTPUT JSON WAJIB (jangan tambah field lain):
{
  "rekomendasi_produk": ["string (maks 5 item)"],
  "analisis_pasar": "string (maks 200 kata)",
  "strategi_pemasaran": ["string (maks 5 item)"],
  "estimasi_harga": {
    "min": number,
    "max": number,
    "satuan": "string (contoh: per buah, per set)"
  },
  "potensi_risiko": ["string (maks 3 item)"],
  "kesimpulan": "string (maks 100 kata)",
  "confidence_score": number
}
`.trim();
};

// -------------------------------------------------------
// Controller: POST /api/ai/analyze
// -------------------------------------------------------
export const analyzeWithAI = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const startTime = Date.now();

  try {
    const { userId } = getAuthLocals(res);
    const {
      context,
      productCategory = 'Umum',
      targetMarket = 'Pasar Lokal',
      additionalNotes = '-',
    } = _req.body as AiAnalysisDto;

    // 1. Deteksi input mencurigakan
    if (detectSuspiciousInput(context)) {
      console.warn(`⚠️ Suspicious input detected from userId: ${userId}`);
      sendBadRequest(res, 'Input mengandung konten yang tidak diperbolehkan.');
      return;
    }

    // 2. Anonimisasi semua input PII
    const safeContext = anonymizePII(context);
    const safeCategory = anonymizePII(productCategory);
    const safeMarket = anonymizePII(targetMarket);
    const safeNotes = anonymizePII(additionalNotes);

    // 3. Bangun prompt dengan data yang sudah dibersihkan
    const prompt = buildAnalysisPrompt(
      safeContext,
      safeCategory,
      safeMarket,
      safeNotes
    );

    // 4. Kirim ke Gemini API
    const geminiResponse = await model.generateContent(prompt);
    const rawText = geminiResponse.response.text();

    // 5. Parse JSON dari response Gemini
    let parsedResult: AiAnalysisResult;
    try {
      parsedResult = JSON.parse(rawText) as AiAnalysisResult;
    } catch {
      console.error('❌ Gemini returned non-JSON response:', rawText);
      sendError(res, 'AI mengembalikan format respons yang tidak valid. Coba lagi.', 502);
      return;
    }

    // 6. Anonimisasi hasil AI (jaga-jaga jika AI bocorkan data)
    const sanitizedResult = anonymizeObject(
      parsedResult as unknown as Record<string, unknown>
    ) as unknown as AiAnalysisResult;

    const processingTimeMs = Date.now() - startTime;

    // 7. Simpan hasil analisis ke database
    const promptContext = JSON.stringify({
      context: safeContext,
      productCategory: safeCategory,
      targetMarket: safeMarket,
      additionalNotes: safeNotes,
    });

    await pool.execute(
      `INSERT INTO ai_analysis_results 
       (user_id, prompt_context, ai_response, model_used, processing_time_ms, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        promptContext,
        JSON.stringify(sanitizedResult),
        GEMINI_MODEL_NAME,
        processingTimeMs,
      ]
    );

    // 8. Kirim hasil ke client
    sendSuccess(
      res,
      {
        analysis: sanitizedResult,
        metadata: {
          model: GEMINI_MODEL_NAME,
          processingTimeMs,
          inputWasAnonymized: true,
        },
      },
      'Analisis AI berhasil diselesaikan.'
    );
  } catch (err) {
    console.error('❌ AI Analysis Error:', err);
    sendError(res, 'Gagal menjalankan analisis AI.', 500, String(err));
  }
};

// -------------------------------------------------------
// Controller: GET /api/ai/history
// -------------------------------------------------------
export const getAiHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = getAuthLocals(res);
    const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
    const limit = Math.min(50, parseInt(req.query['limit'] as string) || 10);
    const offset = (page - 1) * limit;

    const [rows] = await pool.execute(
      `SELECT id, prompt_context, ai_response, model_used, processing_time_ms, created_at
       FROM ai_analysis_results
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const [countRows] = await pool.execute<CountResult[]>(
      'SELECT COUNT(*) as total FROM ai_analysis_results WHERE user_id = ?',
      [userId]
    );

    const total = countRows[0]?.total ?? 0;

    sendSuccess(res, rows, 'Riwayat analisis berhasil diambil.', 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    sendError(res, 'Gagal mengambil riwayat analisis.', 500, String(err));
  }
};
