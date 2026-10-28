// ============================================================
//  src/validators/schemas.ts
//  Skema Validasi Zod untuk Input API Fail-Fast
// ============================================================

import { z } from 'zod';

// 1. Skema Alamat Pengiriman
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

// 2. Skema Keranjang Belanja (Cart)
export const addToCartSchema = z.object({
  product_id: z.number().int().positive('ID produk harus berupa angka positif'),
  quantity: z.number().int().min(1, 'Jumlah minimal 1').default(1),
  variant: z.string().max(100).optional().nullable(),
});

export const updateCartSchema = z.object({
  quantity: z.number().int().min(1, 'Jumlah minimal 1').optional(),
  variant: z.string().max(100).optional().nullable(),
});

// 3. Skema Checkout Pesanan (Orders)
export const checkoutItemSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive(),
  variant: z.string().max(100).optional().nullable(),
  unit_price: z.number().positive().optional(),
});

export const checkoutOrderSchema = z.object({
  mitra_id: z.number().int().positive('ID mitra harus valid'),
  address_id: z.number().int().positive('ID alamat harus valid'),
  shipping_method: z.string().default('Reguler'),
  shipping_cost: z.number().min(0).default(0),
  customer_notes: z.string().max(500).optional().nullable(),
  payment_method: z.enum(['qris', 'transfer', 'cod', 'va']).default('qris'),
  items: z.array(checkoutItemSchema).min(1, 'Pesanan minimal harus memiliki 1 produk'),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'paid', 'packed', 'shipped', 'completed', 'cancelled']),
  tracking_number: z.string().max(100).optional().nullable(),
});

// 4. Skema Ulasan Produk (Reviews)
export const createReviewSchema = z.object({
  product_id: z.number().int().positive('ID produk harus valid'),
  order_item_id: z.number().int().positive().optional().nullable(),
  rating: z.number().int().min(1, 'Rating minimal 1').max(5, 'Rating maksimal 5'),
  variant: z.string().max(100).optional().nullable(),
  comment: z.string().max(1000, 'Komentar maksimal 1000 karakter').optional().nullable(),
  photo_urls: z.array(z.string().url('URL foto ulasan tidak valid')).optional().nullable(),
});

export const replyReviewSchema = z.object({
  seller_reply: z.string().min(1, 'Balasan penjual tidak boleh kosong').max(1000),
});
