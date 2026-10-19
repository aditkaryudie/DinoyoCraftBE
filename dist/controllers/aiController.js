"use strict";
// ============================================================
//  src/controllers/aiController.ts
//  Controller Analisis AI — integrasi Gemini API
//  dengan anonimisasi PII dan strict JSON schema
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAiHistory = exports.analyzeWithAI = void 0;
const generative_ai_1 = require("@google/generative-ai");
const database_js_1 = __importDefault(require("../config/database.js"));
const response_js_1 = require("../utils/response.js");
const piiAnonymizer_js_1 = require("../utils/piiAnonymizer.js");
const authMiddleware_js_1 = require("../middlewares/authMiddleware.js");
// -------------------------------------------------------
// Inisialisasi Gemini Client
// -------------------------------------------------------
const GEMINI_API_KEY = process.env['GEMINI_API_KEY'];
const GEMINI_MODEL_NAME = process.env['GEMINI_MODEL'] ?? 'gemini-1.5-flash';
if (!GEMINI_API_KEY) {
    throw new Error('❌ GEMINI_API_KEY tidak ditemukan di environment variables!');
}
const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
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
// Prompt Engineering dengan Strict JSON Schema
// -------------------------------------------------------
const buildAnalysisPrompt = (context, productCategory, targetMarket, additionalNotes) => {
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
const analyzeWithAI = async (_req, res) => {
    const startTime = Date.now();
    try {
        const { userId } = (0, authMiddleware_js_1.getAuthLocals)(res);
        const { context, productCategory = 'Umum', targetMarket = 'Pasar Lokal', additionalNotes = '-', } = _req.body;
        // 1. Deteksi input mencurigakan
        if ((0, piiAnonymizer_js_1.detectSuspiciousInput)(context)) {
            console.warn(`⚠️ Suspicious input detected from userId: ${userId}`);
            (0, response_js_1.sendBadRequest)(res, 'Input mengandung konten yang tidak diperbolehkan.');
            return;
        }
        // 2. Anonimisasi semua input PII
        const safeContext = (0, piiAnonymizer_js_1.anonymizePII)(context);
        const safeCategory = (0, piiAnonymizer_js_1.anonymizePII)(productCategory);
        const safeMarket = (0, piiAnonymizer_js_1.anonymizePII)(targetMarket);
        const safeNotes = (0, piiAnonymizer_js_1.anonymizePII)(additionalNotes);
        // 3. Bangun prompt dengan data yang sudah dibersihkan
        const prompt = buildAnalysisPrompt(safeContext, safeCategory, safeMarket, safeNotes);
        // 4. Kirim ke Gemini API
        const geminiResponse = await model.generateContent(prompt);
        const rawText = geminiResponse.response.text();
        // 5. Parse JSON dari response Gemini
        let parsedResult;
        try {
            parsedResult = JSON.parse(rawText);
        }
        catch {
            console.error('❌ Gemini returned non-JSON response:', rawText);
            (0, response_js_1.sendError)(res, 'AI mengembalikan format respons yang tidak valid. Coba lagi.', 502);
            return;
        }
        // 6. Anonimisasi hasil AI (jaga-jaga jika AI bocorkan data)
        const sanitizedResult = (0, piiAnonymizer_js_1.anonymizeObject)(parsedResult);
        const processingTimeMs = Date.now() - startTime;
        // 7. Simpan hasil analisis ke database
        const promptContext = JSON.stringify({
            context: safeContext,
            productCategory: safeCategory,
            targetMarket: safeMarket,
            additionalNotes: safeNotes,
        });
        await database_js_1.default.execute(`INSERT INTO ai_analysis_results 
       (user_id, prompt_context, ai_response, model_used, processing_time_ms, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`, [
            userId,
            promptContext,
            JSON.stringify(sanitizedResult),
            GEMINI_MODEL_NAME,
            processingTimeMs,
        ]);
        // 8. Kirim hasil ke client
        (0, response_js_1.sendSuccess)(res, {
            analysis: sanitizedResult,
            metadata: {
                model: GEMINI_MODEL_NAME,
                processingTimeMs,
                inputWasAnonymized: true,
            },
        }, 'Analisis AI berhasil diselesaikan.');
    }
    catch (err) {
        console.error('❌ AI Analysis Error:', err);
        (0, response_js_1.sendError)(res, 'Gagal menjalankan analisis AI.', 500, String(err));
    }
};
exports.analyzeWithAI = analyzeWithAI;
// -------------------------------------------------------
// Controller: GET /api/ai/history
// -------------------------------------------------------
const getAiHistory = async (req, res) => {
    try {
        const { userId } = (0, authMiddleware_js_1.getAuthLocals)(res);
        const page = Math.max(1, parseInt(req.query['page']) || 1);
        const limit = Math.min(50, parseInt(req.query['limit']) || 10);
        const offset = (page - 1) * limit;
        const [rows] = await database_js_1.default.execute(`SELECT id, prompt_context, ai_response, model_used, processing_time_ms, created_at
       FROM ai_analysis_results
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`, [userId, limit, offset]);
        const [countRows] = await database_js_1.default.execute('SELECT COUNT(*) as total FROM ai_analysis_results WHERE user_id = ?', [userId]);
        const total = countRows[0]?.total ?? 0;
        (0, response_js_1.sendSuccess)(res, rows, 'Riwayat analisis berhasil diambil.', 200, {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        });
    }
    catch (err) {
        (0, response_js_1.sendError)(res, 'Gagal mengambil riwayat analisis.', 500, String(err));
    }
};
exports.getAiHistory = getAiHistory;
//# sourceMappingURL=aiController.js.map