import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Pastikan folder uploads tersedia secara otomatis
const targetFolder = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(targetFolder)) {
  fs.mkdirSync(targetFolder, { recursive: true });
}

// Konfigurasi penyimpanan file menggunakan DiskStorage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, targetFolder); // <-- Pastikan Multer menembak ke targetFolder
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Kita gunakan .fields() karena ada beberapa jenis file yang berbeda
export const uploadMitraDocs = multer({ storage }).fields([
  { name: 'ktp_file', maxCount: 1 },
  { name: 'nib_file', maxCount: 1 },
  { name: 'product_images', maxCount: 5 },
  { name: 'sample_product_images', maxCount: 5 },
]);

export const uploadProfileImages = multer({ storage }).fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'banner', maxCount: 1 },
]);

const upload = multer({ storage });
export default upload;
