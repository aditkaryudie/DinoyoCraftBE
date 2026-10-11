// ============================================================
//  src/utils/piiAnonymizer.ts
//  Utilitas Anonimisasi Data PII sebelum dikirim ke Gemini AI
//  Mencegah prompt injection dan kebocoran data sensitif
// ============================================================

/**
 * Pola regex untuk mendeteksi PII (Personally Identifiable Information)
 */
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Email
  {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL_DIREDAKSI]',
  },
  // Nomor telepon Indonesia (08xx, +628xx, 628xx)
  {
    pattern: /(?:\+62|62|0)8[0-9]{8,11}/g,
    replacement: '[NOMOR_HP_DIREDAKSI]',
  },
  // NIK (16 digit angka)
  {
    pattern: /\b\d{16}\b/g,
    replacement: '[NIK_DIREDAKSI]',
  },
  // Nomor KTP / kartu identitas
  {
    pattern: /\b(?:nik|ktp|nip|nim)\s*:?\s*\d{8,16}/gi,
    replacement: '[ID_DIREDAKSI]',
  },
  // Nama lengkap (heuristik: 2-4 kata diawali huruf kapital)
  {
    pattern: /\b([A-Z][a-z]{1,20})\s([A-Z][a-z]{1,20})(?:\s([A-Z][a-z]{1,20}))?(?:\s([A-Z][a-z]{1,20}))?\b/g,
    replacement: '[NAMA_DIREDAKSI]',
  },
  // Alamat (mengandung kata jl, jalan, rt, rw, dsb.)
  {
    pattern: /(?:jl\.|jalan|gg\.|gang|rt|rw|no\.|nomor)\s+[^\n,]{3,50}/gi,
    replacement: '[ALAMAT_DIREDAKSI]',
  },
  // Password / token yang tidak sengaja masuk
  {
    pattern: /(?:password|passwd|pwd|token|secret|api_key)\s*[=:]\s*\S+/gi,
    replacement: '[KREDENSIAL_DIREDAKSI]',
  },
];

/**
 * Karakter berbahaya untuk prompt injection
 */
const INJECTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Instruksi override / jailbreak umum
  {
    pattern: /ignore\s+(all\s+)?previous\s+instructions?/gi,
    replacement: '[INSTRUKSI_TIDAK_VALID]',
  },
  {
    pattern: /you\s+are\s+now\s+(?:a\s+)?(?:different|new|another)/gi,
    replacement: '[INSTRUKSI_TIDAK_VALID]',
  },
  {
    pattern: /forget\s+(?:all\s+)?(?:your\s+)?(?:previous\s+)?(?:instructions?|rules?|context)/gi,
    replacement: '[INSTRUKSI_TIDAK_VALID]',
  },
  // SQL injection-like patterns
  {
    pattern: /;\s*(?:drop|delete|truncate|insert|update|select)\s+/gi,
    replacement: '[QUERY_TIDAK_VALID]',
  },
  // Script injection
  {
    pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    replacement: '[SCRIPT_DIREDAKSI]',
  },
];

/**
 * Batas panjang input konteks yang aman
 */
const MAX_CONTEXT_LENGTH = 2000;

/**
 * Anonimisasi teks dari PII dan prompt injection
 * @param text Teks mentah dari pengguna
 * @returns Teks yang sudah dibersihkan dan aman
 */
export const anonymizePII = (text: string): string => {
  let sanitized = text.trim();

  // 1. Batasi panjang input
  if (sanitized.length > MAX_CONTEXT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_CONTEXT_LENGTH) + '...[TERPOTONG]';
  }

  // 2. Hapus prompt injection
  for (const { pattern, replacement } of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  // 3. Anonimisasi PII
  for (const { pattern, replacement } of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  return sanitized;
};

/**
 * Anonimisasi objek — memproses semua string value secara rekursif
 * @param obj Objek dengan kemungkinan mengandung PII
 * @returns Objek yang sudah dibersihkan
 */
export const anonymizeObject = <T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = anonymizePII(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = anonymizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'string'
          ? anonymizePII(item)
          : typeof item === 'object' && item !== null
          ? anonymizeObject(item as Record<string, unknown>)
          : item
      );
    } else {
      result[key] = value;
    }
  }

  return result;
};

/**
 * Audit log untuk input yang mencurigakan
 */
export const detectSuspiciousInput = (text: string): boolean => {
  return INJECTION_PATTERNS.some(({ pattern }) => {
    pattern.lastIndex = 0; // reset regex state
    return pattern.test(text);
  });
};
