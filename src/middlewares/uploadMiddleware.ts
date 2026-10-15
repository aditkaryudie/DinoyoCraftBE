import multer from 'multer';
import path from 'path';

// Konfigurasi tempat penyimpanan dan nama file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Pastikan folder 'uploads' sudah Anda buat
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Kita gunakan .fields() karena ada beberapa jenis file yang berbeda
export const uploadMitraDocs = multer({ storage }).fields([
  { name: 'ktp_file', maxCount: 1 },
  { name: 'nib_file', maxCount: 1 },
  { name: 'product_images', maxCount: 3 }
]);