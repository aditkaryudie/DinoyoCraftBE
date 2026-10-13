// ============================================================
//  src/middlewares/uploadMiddleware.ts
//  Middleware untuk handle file uploads dengan multer
// ============================================================

import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tentukan folder upload
const uploadDir = path.join(__dirname, '../../uploads/documents');

// Pastikan folder ada
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = (req as any).user?.id || 'temp';
    const userUploadDir = path.join(uploadDir, String(userId));
    
    if (!fs.existsSync(userUploadDir)) {
      fs.mkdirSync(userUploadDir, { recursive: true });
    }
    
    cb(null, userUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Filter file
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed MIME types
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/pdf',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} tidak diizinkan`));
  }
};

// Export multer instance
export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

// Middleware untuk upload multiple field dengan berbeda file count
export const uploadRegistrationDocs = uploadMiddleware.fields([
  { name: 'ktp', maxCount: 1 },
  { name: 'nib', maxCount: 1 },
  { name: 'product_photos', maxCount: 10 },
]);
