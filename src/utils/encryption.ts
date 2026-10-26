import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
// Kunci ini harus tepat 32 karakter. Sebaiknya taruh di file .env nanti
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'dinoyocraft_secret_key_32_chars!';
const IV_LENGTH = 16;

export const encryptMessage = (text: string): string => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

export const decryptMessage = (text: string): string => {
    try {
        const textParts = text.split(':');
        // Jika format tidak sesuai (misal: pesan lama yang belum dienkripsi), kembalikan teks aslinya
        if (textParts.length !== 2) return text;

        const iv = Buffer.from(textParts.shift() as string, 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);

        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString();
    } catch (error) {
        return text; // Fallback jika gagal dekripsi (pesan lama)
    }
};