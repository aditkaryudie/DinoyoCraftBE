"use strict";
// ============================================================
//  src/validators/schemas.ts
//  Skema Validasi Zod Komprehensif untuk Seluruh REST API DinoyoCraft
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDeletionActionSchema = exports.handleReportActionSchema = exports.aiAnalysisSchema = exports.verifyMitraStoreSchema = exports.createMasterDataSchema = exports.updateUserStatusSchema = exports.sendMessageSchema = exports.updateProductSchema = exports.createProductSchema = exports.updateProfileSchema = exports.resetPasswordSchema = exports.verifyOtpSchema = exports.forgotPasswordSchema = exports.googleLoginSchema = exports.loginSchema = exports.registerMitraSchema = exports.replyReviewSchema = exports.createReviewSchema = exports.updateOrderStatusSchema = exports.checkoutOrderSchema = exports.checkoutItemSchema = exports.updateCartSchema = exports.addToCartSchema = exports.updateAddressSchema = exports.createAddressSchema = void 0;
const zod_1 = require("zod");
// ============================================================
// 1. Skema Alamat Pengiriman (User Addresses)
// ============================================================
exports.createAddressSchema = zod_1.z.object({
    recipient_name: zod_1.z.string().min(2, 'Nama penerima minimal 2 karakter').max(100),
    phone: zod_1.z.string().min(9, 'Nomor HP minimal 9 digit').max(20),
    full_address: zod_1.z.string().min(5, 'Alamat lengkap minimal 5 karakter'),
    city: zod_1.z.string().min(2, 'Kota minimal 2 karakter').max(100).optional().nullable(),
    postal_code: zod_1.z.string().max(20, 'Kode pos maksimal 20 karakter').optional().nullable(),
    label: zod_1.z.string().max(50).default('Rumah'),
    is_default: zod_1.z.union([zod_1.z.boolean(), zod_1.z.number()]).transform((val) => Boolean(val)).optional(),
});
exports.updateAddressSchema = exports.createAddressSchema.partial();
// ============================================================
// 2. Skema Keranjang Belanja (Cart)
// ============================================================
exports.addToCartSchema = zod_1.z.object({
    product_id: zod_1.z.coerce.number().int().positive('ID produk harus berupa angka positif'),
    quantity: zod_1.z.coerce.number().int().min(1, 'Jumlah minimal 1').default(1),
    variant: zod_1.z.string().max(100).optional().nullable(),
});
exports.updateCartSchema = zod_1.z.object({
    quantity: zod_1.z.coerce.number().int().min(1, 'Jumlah minimal 1').optional(),
    variant: zod_1.z.string().max(100).optional().nullable(),
});
// ============================================================
// 3. Skema Checkout & Pesanan (Orders)
// ============================================================
exports.checkoutItemSchema = zod_1.z.object({
    product_id: zod_1.z.coerce.number().int().positive(),
    quantity: zod_1.z.coerce.number().int().positive(),
    variant: zod_1.z.string().max(100).optional().nullable(),
    unit_price: zod_1.z.coerce.number().positive().optional(),
});
exports.checkoutOrderSchema = zod_1.z.object({
    mitra_id: zod_1.z.coerce.number().int().positive('ID mitra harus valid'),
    address_id: zod_1.z.coerce.number().int().positive('ID alamat harus valid'),
    shipping_method: zod_1.z.string().default('Reguler'),
    shipping_cost: zod_1.z.coerce.number().min(0).default(0),
    customer_notes: zod_1.z.string().max(500).optional().nullable(),
    payment_method: zod_1.z.enum(['qris', 'transfer', 'cod', 'va']).default('qris'),
    items: zod_1.z.array(exports.checkoutItemSchema).min(1, 'Pesanan minimal harus memiliki 1 produk'),
});
exports.updateOrderStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['pending', 'paid', 'packed', 'shipped', 'completed', 'cancelled']),
    tracking_number: zod_1.z.string().max(100).optional().nullable(),
});
// ============================================================
// 4. Skema Ulasan Produk (Reviews)
// ============================================================
exports.createReviewSchema = zod_1.z.object({
    product_id: zod_1.z.coerce.number().int().positive('ID produk harus valid'),
    order_item_id: zod_1.z.coerce.number().int().positive().optional().nullable(),
    rating: zod_1.z.coerce.number().int().min(1, 'Rating minimal 1').max(5, 'Rating maksimal 5'),
    variant: zod_1.z.string().max(100).optional().nullable(),
    comment: zod_1.z.string().max(1000, 'Komentar maksimal 1000 karakter').optional().nullable(),
    photo_urls: zod_1.z.array(zod_1.z.string()).optional().nullable(),
});
exports.replyReviewSchema = zod_1.z.object({
    seller_reply: zod_1.z.string().min(1, 'Balasan penjual tidak boleh kosong').max(1000),
});
// ============================================================
// 5. Skema Autentikasi & Akun (Auth)
// ============================================================
exports.registerMitraSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Nama minimal 2 karakter').max(100),
    email: zod_1.z.string().email('Format email tidak valid'),
    password: zod_1.z.string().min(8, 'Password minimal 8 karakter').optional().nullable(),
    whatsapp_number: zod_1.z
        .string()
        .regex(/^[0-9]+$/, 'Nomor HP hanya boleh berisi angka')
        .min(10, 'Nomor HP minimal 10 digit')
        .max(14, 'Nomor HP maksimal 14 digit'),
    store_name: zod_1.z.string().min(1, 'Nama toko wajib diisi').max(150),
    workshop_address: zod_1.z.string().min(1, 'Alamat workshop wajib diisi'),
    started_year: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional().nullable(),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Format email tidak valid'),
    password: zod_1.z.string().min(1, 'Password wajib diisi'),
});
exports.googleLoginSchema = zod_1.z
    .object({
    credential: zod_1.z.string().optional(),
    userInfo: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
})
    .refine((data) => data.credential || data.userInfo, {
    message: 'Data otentikasi Google wajib dikirim',
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Format email tidak valid'),
});
exports.verifyOtpSchema = zod_1.z.object({
    email: zod_1.z.string().email('Format email tidak valid'),
    otp: zod_1.z.string().min(4, 'Kode OTP minimal 4 digit').max(10, 'Kode OTP maksimal 10 digit'),
});
exports.resetPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Format email tidak valid'),
    newPassword: zod_1.z.string().min(8, 'Password baru minimal 8 karakter'),
    otp: zod_1.z.string().optional().nullable(),
});
exports.updateProfileSchema = zod_1.z.object({
    ownerName: zod_1.z.string().optional(),
    nama: zod_1.z.string().optional(),
    storeName: zod_1.z.string().optional(),
    nama_toko: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    whatsapp_number: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    alamat: zod_1.z.string().optional(),
    workshop_address: zod_1.z.string().optional(),
    yearStarted: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    tahun_mulai: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    started_year: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional(),
    description: zod_1.z.string().optional(),
    deskripsi: zod_1.z.string().optional(),
    website: zod_1.z.string().optional().nullable(),
    instagram: zod_1.z.string().optional().nullable(),
});
// ============================================================
// 6. Skema Katalog Produk (Products)
// ============================================================
exports.createProductSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Nama produk minimal 2 karakter').max(200),
    description: zod_1.z.string().optional().nullable(),
    price: zod_1.z.coerce.number().min(0, 'Harga produk tidak boleh negatif'),
    stock: zod_1.z.coerce.number().int().min(0, 'Stok produk tidak boleh negatif'),
    category_id: zod_1.z.coerce.number().int().positive('Kategori produk wajib diisi'),
    weight_gram: zod_1.z.coerce.number().int().min(1).default(500).optional(),
    variants: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.any())]).optional().nullable(),
});
exports.updateProductSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(200).optional(),
    title: zod_1.z.string().min(2).max(200).optional(),
    description: zod_1.z.string().optional().nullable(),
    price: zod_1.z.coerce.number().min(0).optional(),
    stock: zod_1.z.coerce.number().int().min(0).optional(),
    category_id: zod_1.z.coerce.number().int().positive().optional(),
    weight_gram: zod_1.z.coerce.number().int().min(1).optional(),
    variants: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.any())]).optional().nullable(),
});
// ============================================================
// 7. Skema Live Chat (Messages)
// ============================================================
exports.sendMessageSchema = zod_1.z.object({
    message: zod_1.z.string().min(1, 'Pesan tidak boleh kosong').max(2000, 'Pesan maksimal 2000 karakter'),
});
// ============================================================
// 8. Skema Administrasi (Admin & Master Data)
// ============================================================
exports.updateUserStatusSchema = zod_1.z.object({
    is_active: zod_1.z.coerce.boolean(),
});
exports.createMasterDataSchema = zod_1.z.object({
    category: zod_1.z.string().min(1, 'Kategori master data wajib diisi').max(50),
    key: zod_1.z.string().min(1, 'Key master data wajib diisi').max(100),
    value: zod_1.z.string().min(1, 'Value master data wajib diisi'),
    description: zod_1.z.string().max(255).optional().nullable(),
});
exports.verifyMitraStoreSchema = zod_1.z.object({
    status: zod_1.z.enum(['approved', 'rejected', 'terverifikasi', 'ditolak']),
    reason: zod_1.z.string().optional().nullable(),
    rejection_reason: zod_1.z.string().optional().nullable(),
});
// ============================================================
// 9. Skema AI Analisis (AI)
// ============================================================
exports.aiAnalysisSchema = zod_1.z.object({
    context: zod_1.z.string().min(10, 'Konteks analisis minimal 10 karakter').max(2000, 'Konteks analisis maksimal 2000 karakter'),
    productCategory: zod_1.z.string().max(100).optional().nullable(),
    targetMarket: zod_1.z.string().max(100).optional().nullable(),
    additionalNotes: zod_1.z.string().max(500).optional().nullable(),
});
// ============================================================
// 10. Skema Moderasi & Pengaduan (Moderation)
// ============================================================
exports.handleReportActionSchema = zod_1.z.object({
    action: zod_1.z.enum(['abaikan', 'suspend', 'hapus', 'delete', 'ignore', 'takedown']),
    targetId: zod_1.z.coerce.number().optional().nullable(),
    type: zod_1.z.string().optional().nullable(),
});
exports.handleDeletionActionSchema = zod_1.z.object({
    action: zod_1.z.enum(['approved', 'rejected']),
});
//# sourceMappingURL=schemas.js.map