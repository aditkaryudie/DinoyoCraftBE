"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadProfileImages = exports.uploadMitraDocs = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// 1. Kunci target ke folder DinoyoCraftBE/uploads
const targetFolder = path_1.default.join(process.cwd(), 'uploads');
// 2. Buat folder otomatis jika tidak sengaja terhapus/belum ada
if (!fs_1.default.existsSync(targetFolder)) {
    fs_1.default.mkdirSync(targetFolder, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, targetFolder); // <-- Pastikan Multer menembak ke targetFolder
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path_1.default.extname(file.originalname));
    },
});
// Kita gunakan .fields() karena ada beberapa jenis file yang berbeda
exports.uploadMitraDocs = (0, multer_1.default)({ storage }).fields([
    { name: 'ktp_file', maxCount: 1 },
    { name: 'nib_file', maxCount: 1 },
    { name: 'product_images', maxCount: 3 },
]);
exports.uploadProfileImages = (0, multer_1.default)({ storage }).fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
]);
const upload = (0, multer_1.default)({ storage });
exports.default = upload;
//# sourceMappingURL=uploadMiddleware.js.map