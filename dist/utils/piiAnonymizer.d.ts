/**
 * Anonimisasi teks dari PII dan prompt injection
 * @param text Teks mentah dari pengguna
 * @returns Teks yang sudah dibersihkan dan aman
 */
export declare const anonymizePII: (text: string) => string;
/**
 * Anonimisasi objek — memproses semua string value secara rekursif
 * @param obj Objek dengan kemungkinan mengandung PII
 * @returns Objek yang sudah dibersihkan
 */
export declare const anonymizeObject: <T extends Record<string, unknown>>(obj: T) => Record<string, unknown>;
/**
 * Audit log untuk input yang mencurigakan
 */
export declare const detectSuspiciousInput: (text: string) => boolean;
//# sourceMappingURL=piiAnonymizer.d.ts.map