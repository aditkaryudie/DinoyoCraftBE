// ============================================================
//  src/validators/schemas.ts
//  Skema Validasi Zod Komprehensif untuk Seluruh REST API DinoyoCraft
// ============================================================

import { z } from 'zod';

// ============================================================
// 1. Skema Alamat Pengiriman (User Addresses)
// ============================================================
export const createAddressSchema = z.object({
  recipient_name: z.string().min(2, 'Nama penerima minimal 2 karakter').max(100),
  phone: z.string().min(9, 'Nomor HP minimal 9 digit').max(20),
  full_address: z.string().min(5, 'Alamat lengkap minimal 5 karakter'),
  city: z.string().min(2, 'Kota minimal 2 karakter').max(100).optional().nullable(),
  postal_code: z.string().max(20, 'Kode pos maksimal 20 karakter').optional().nullable(),
  label: z.string().max(50).default('Rumah'),
  is_default: z.union([z.boolean(), z.number()]).transform((val) => Boolean(val)).optional(),
});

export const updateAddressSchema = createAddressSchema.partial();

// ============================================================
// 2. Skema Keranjang Belanja (Cart)
// ============================================================
export const addToCartSchema = z.object({
  product_id: z.coerce.number().int().positive('ID produk harus berupa angka positif'),
  quantity: z.coerce.number().int().min(1, 'Jumlah minimal 1').default(1),
  variant: z.string().max(100).optional().nullable(),
});

export const updateCartSchema = z.object({
  quantity: z.coerce.number().int().min(1, 'Jumlah minimal 1').optional(),
  variant: z.string().max(100).optional().nullable(),
});

// ============================================================
// 3. Skema Checkout & Pesanan (Orders)
// ============================================================
export const checkoutItemSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
  variant: z.string().max(100).optional().nullable(),
  unit_price: z.coerce.number().positive().optional(),
});

export const checkoutOrderSchema = z.object({
  mitra_id: z.coerce.number().int().positive('ID mitra harus valid'),
  address_id: z.coerce.number().int().positive('ID alamat harus valid'),
  shipping_method: z.string().default('Reguler'),
  shipping_cost: z.coerce.number().min(0).default(0),
  customer_notes: z.string().max(500).optional().nullable(),
  payment_method: z.enum(['qris', 'transfer', 'cod', 'va']).default('qris'),
  items: z.array(checkoutItemSchema).min(1, 'Pesanan minimal harus memiliki 1 produk'),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'paid', 'packed', 'shipped', 'completed', 'cancelled']),
  tracking_number: z.string().max(100).optional().nullable(),
});

// ============================================================
// 4. Skema Ulasan Produk (Reviews)
// ============================================================
export const createReviewSchema = z.object({
  product_id: z.coerce.number().int().positive('ID produk harus valid'),
  order_item_id: z.coerce.number().int().positive().optional().nullable(),
  rating: z.coerce.number().int().min(1, 'Rating minimal 1').max(5, 'Rating maksimal 5'),
  variant: z.string().max(100).optional().nullable(),
  comment: z.string().max(1000, 'Komentar maksimal 1000 karakter').optional().nullable(),
  photo_urls: z.array(z.string()).optional().nullable(),
});

export const replyReviewSchema = z.object({
  seller_reply: z.string().min(1, 'Balasan penjual tidak boleh kosong').max(1000),
});

// ============================================================
// 5. Skema Autentikasi & Akun (Auth)
// ============================================================
export const registerMitraSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter').optional().nullable(),
  whatsapp_number: z
    .string()
    .regex(/^[0-9]+$/, 'Nomor HP hanya boleh berisi angka')
    .min(10, 'Nomor HP minimal 10 digit')
    .max(14, 'Nomor HP maksimal 14 digit'),
  store_name: z.string().min(1, 'Nama toko wajib diisi').max(150),
  workshop_address: z.string().min(1, 'Alamat workshop wajib diisi'),
  started_year: z.union([z.string(), z.number()]).optional().nullable(),
});

export const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const googleLoginSchema = z
  .object({
    credential: z.string().optional(),
    userInfo: z.record(z.string(), z.any()).optional(),
  })
  .refine((data) => data.credential || data.userInfo, {
    message: 'Data otentikasi Google wajib dikirim',
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email('Format email tidak valid'),
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  otp: z.string().min(4, 'Kode OTP minimal 4 digit').max(10, 'Kode OTP maksimal 10 digit'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter'),
  otp: z.string().optional().nullable(),
});

export const updateProfileSchema = z.object({
  ownerName: z.string().optional(),
  nama: z.string().optional(),
  storeName: z.string().optional(),
  nama_toko: z.string().optional(),
  phone: z.string().optional(),
  whatsapp_number: z.string().optional(),
  address: z.string().optional(),
  alamat: z.string().optional(),
  workshop_address: z.string().optional(),
  yearStarted: z.union([z.string(), z.number()]).optional(),
  tahun_mulai: z.union([z.string(), z.number()]).optional(),
  started_year: z.union([z.string(), z.number()]).optional(),
  description: z.string().optional(),
  deskripsi: z.string().optional(),
  website: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
});

// ============================================================
// 6. Skema Katalog Produk (Products)
// ============================================================
export const createProductSchema = z.object({
  name: z.string().min(2, 'Nama produk minimal 2 karakter').max(200),
  description: z.string().optional().nullable(),
  price: z.coerce.number().min(0, 'Harga produk tidak boleh negatif'),
  stock: z.coerce.number().int().min(0, 'Stok produk tidak boleh negatif'),
  category_id: z.coerce.number().int().positive('Kategori produk wajib diisi'),
  weight_gram: z.coerce.number().int().min(1).default(500).optional(),
  variants: z.union([z.string(), z.array(z.any())]).optional().nullable(),
});

export const updateProductSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  title: z.string().min(2).max(200).optional(),
  description: z.string().optional().nullable(),
  price: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(),
  category_id: z.coerce.number().int().positive().optional(),
  weight_gram: z.coerce.number().int().min(1).optional(),
  variants: z.union([z.string(), z.array(z.any())]).optional().nullable(),
});

// ============================================================
// 7. Skema Live Chat (Messages)
// ============================================================
export const sendMessageSchema = z.object({
  message: z.string().min(1, 'Pesan tidak boleh kosong').max(2000, 'Pesan maksimal 2000 karakter'),
});

// ============================================================
// 8. Skema Administrasi (Admin & Master Data)
// ============================================================
export const updateUserStatusSchema = z.object({
  is_active: z.coerce.boolean(),
});

export const createMasterDataSchema = z.object({
  category: z.string().min(1, 'Kategori master data wajib diisi').max(50),
  key: z.string().min(1, 'Key master data wajib diisi').max(100),
  value: z.string().min(1, 'Value master data wajib diisi'),
  description: z.string().max(255).optional().nullable(),
});

export const verifyMitraStoreSchema = z.object({
  status: z.enum(['approved', 'rejected', 'terverifikasi', 'ditolak']),
  reason: z.string().optional().nullable(),
  rejection_reason: z.string().optional().nullable(),
});

// ============================================================
// 9. Skema AI Analisis (AI)
// ============================================================
export const aiAnalysisSchema = z.object({
  context: z.string().min(10, 'Konteks analisis minimal 10 karakter').max(2000, 'Konteks analisis maksimal 2000 karakter'),
  productCategory: z.string().max(100).optional().nullable(),
  targetMarket: z.string().max(100).optional().nullable(),
  additionalNotes: z.string().max(500).optional().nullable(),
});

// ============================================================
// 10. Skema Moderasi & Pengaduan (Moderation)
// ============================================================
export const handleReportActionSchema = z.object({
  action: z.enum(['abaikan', 'suspend', 'hapus', 'delete', 'ignore', 'takedown']),
  targetId: z.coerce.number().optional().nullable(),
  type: z.string().optional().nullable(),
});

export const handleDeletionActionSchema = z.object({
  action: z.enum(['approved', 'rejected']),
});
