# 🏺 DinoyoCraft — Backend RESTful API

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v20+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-5.x-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/MySQL-8.x-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL" />
  <img src="https://img.shields.io/badge/Zod-Validation-3E67B1?style=for-the-badge&logo=zod&logoColor=white" alt="Zod" />
  <img src="https://img.shields.io/badge/Pusher-Channels-9B51E0?style=for-the-badge&logo=pusher&logoColor=white" alt="Pusher" />
  <img src="https://img.shields.io/badge/Google_Gemini_AI-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Google Gemini" />
</p>

Backend RESTful API untuk **DinoyoCraft**, platform e-commerce multi-vendor dan katalog keramik khas **Kampung Wisata Keramik Dinoyo, Kota Malang**. Layanan backend ini menangani seluruh logika bisnis e-commerce, manajemen peran (RBAC), autentikasi ganda (JWT & Google OAuth), validasi input *fail-fast* terpusat (Zod), obrolan real-time via Pusher dengan enkripsi database (AES-256-CBC), transaksi checkout pesanan, ulasan dan penilaian produk, manajemen buku alamat, panel moderasi admin, penyimpanan media, asisten cerdas berbasis Google Gemini AI, hingga audit logging otomatis.

---

## 👥 Tim Pengembang (Kelompok 1 - Kelas T3C)

- Mochammad Al Mizan Ya Hafidl
- Moh Ali Farda Al Ghifari
- Aditya Karyudie

---

## ✨ Fitur Utama

- 🔐 **Autentikasi & Otorisasi Lengkap (RBAC)**:
  - Role: `admin`, `mitra`, dan `pengunjung`.
  - Akses JWT Token dengan mekanisme invalidasi sesi (`token_version`).
  - Google OAuth 2.0 Single Sign-On (Google Login).
  - Alur Lupa Password & Verifikasi OTP 6-digit via SMTP Gmail (Nodemailer) dengan template email HTML branded DinoyoCraft, logo resmi tersemat via CID (Content-ID inline), dan penyimpanan persisten di database (`user_otps`) sehingga tangguh di lingkungan *serverless*.
- 🛡️ **Validasi Input Terpusat & Keamanan HTTP**:
  - **Zod Fail-Fast Validation**: Seluruh payload API divalidasi ketat menggunakan Zod Schema sebelum menyentuh controller bisnis.
  - **Helmet Security**: Header keamanan HTTP aktif dengan `crossOriginResourcePolicy: { policy: 'cross-origin' }` agar file media dan gambar upload tidak terblokir di Web & Mobile.
  - **Express Rate Limit**: Proteksi terhadap serangan brute force dan DDoS (500 req/15 menit per IP).
- 🛒 **E-Commerce & Transaksi Lengkap**:
  - **Keranjang Belanja (`carts`)**: Dukungan multi-item, varian keramik, dan kalkulasi subtotal otomatis.
  - **Buku Alamat (`user_addresses`)**: Manajemen multi-alamat pengiriman dengan opsi set default.
  - **Checkout & Pesanan (`orders`, `order_items`, `transactions`)**: Transaksi atomik database, pengurangan stok otomatis, pembuatan kode referensi unik, dan riwayat pesanan (Customer & Mitra).
- ⭐ **Ulasan Produk & Rating Toko (`reviews`)**:
  - Rating bintang 1–5, foto unboxing, tanggapan balasan dari penjual (*seller reply*), dan penghitungan cache rating otomatis pada produk dan profil toko.
- 🔔 **Pusat Notifikasi Akun (`notifications`)**:
  - Notifikasi real-time in-app untuk status pembaruan pesanan, verifikasi toko mitra, dan pengumuman sistem.
- 💬 **Sistem Chat Real-Time & Enkripsi Data (Pusher & AES-256-CBC)**:
  - Komunikasi obrolan real-time berlatensi rendah menggunakan **Pusher Channels**.
  - **Enkripsi Simetris AES-256-CBC** pada penyimpanan pesan di database untuk menjaga privasi percakapan.
  - Dekripsi otomatis saat pesan diambil oleh pengguna terautentikasi.
  - Daftar kontak percakapan real-time dengan pratinjau pesan terakhir dan indikator *unread count*.
- 🛡️ **Panel Kontrol Admin & Sistem Moderasi Terpadu**:
  - Ringkasan statistik performa platform secara real-time.
  - Verifikasi pendaftaran toko mitra (Setujui / Tolak + alasan penolakan).
  - Manajemen akun pengguna (aktivasi / penonaktifan akun).
  - **Moderasi & Keamanan**:
    - **Tab 1 — Laporan Pelanggaran**: Penanganan aduan terhadap Toko, Produk, dan Ulasan dengan aksi suspend toko/produk, hapus konten ulasan, atau abaikan laporan.
    - **Tab 2 — Pengajuan Hapus Akun**: Persetujuan atau penolakan pengajuan penghapusan akun customer secara terpusat.
  - Konfigurasi Data Master dinamis (kategori produk, status transaksi, dll.).
- 🤖 **Integrasi Google Gemini AI**:
  - Analisis strategi bisnis, rekomendasi harga, dan tren keramik untuk pengrajin Dinoyo.
  - Penyimpanan riwayat konsultasi AI ke database (`ai_analysis_results`).
- 📂 **Manajemen Media & File Statis**:
  - Upload berkas dan foto produk yang aman via Multer.
  - Penyajian file statis langsung melalui endpoint `/uploads`.

---

## 💻 Tech Stack & Pustaka

| Kategori | Teknologi / Library |
| :--- | :--- |
| **Runtime Environment** | [Node.js](https://nodejs.org/) (v20 ke atas) |
| **Framework** | [Express.js](https://expressjs.com/) (v5.x) |
| **Bahasa Pemrograman** | [TypeScript](https://www.typescriptlang.org/) (v5.x) via `tsx` |
| **Database** | [MySQL 8.x](https://www.mysql.com/) (Koneksi pool via `mysql2`) |
| **Validasi Skema** | [Zod](https://zod.dev/) (v4.x) |
| **Keamanan HTTP** | `helmet` (v8.x), `express-rate-limit` (v8.x) |
| **Real-Time WebSockets** | [Pusher Server SDK](https://pusher.com/) (`pusher` v5.x) |
| **Enkripsi Pesan** | Node.js `crypto` (AES-256-CBC, IV 16-bytes, Secret Key 32-chars) |
| **AI Engine** | [@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai) (Google Gemini Flash) |
| **Autentikasi & Hashing** | `jsonwebtoken`, `google-auth-library`, `bcryptjs` |
| **File Handling** | `multer` |
| **Mailer** | `nodemailer` |
| **Cross-Origin & Env** | `cors`, `dotenv` |

---

## 📋 Prasyarat Sistem

Sebelum menjalankan proyek, pastikan perangkat lokal Anda telah terpasang:
- **Node.js** `>= 20.0.0` ([Unduh Node.js](https://nodejs.org/))
- **npm** (biasanya terpasang bersama Node.js)
- **Git**
- **MySQL Server** (melalui [XAMPP](https://www.apachefriends.org/), Laragon, atau instalasi native MySQL)
- Akun [Pusher Channels](https://pusher.com/) (tersedia tier gratis untuk App ID, Key, Secret, & Cluster)

---

## 🚀 Panduan Instalasi & Setup Lokal

### 1. Clone Repositori & Pilih Branch
```bash
git clone https://github.com/aditkaryudie/DinoyoCraftBE.git
cd DinoyoCraftBE
git checkout ali   # Branch pengembangan aktif
```

### 2. Install Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment Variables (`.env`)
Salin berkas template lingkungan `.env.example` menjadi `.env` di folder root backend:

```bash
cp .env.example .env
```

Buka file `.env` dan lengkapi konfigurasi berikut:
```env
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database MySQL
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=            # Kosongkan jika menggunakan default XAMPP
DB_NAME=dinoyocraft_db

# JSON Web Token
JWT_SECRET=buat_kunci_jwt_yang_sangat_rahasia_dan_panjang_minimal_32_karakter
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=kunci_rahasia_refresh_token_minimal_32_karakter
JWT_REFRESH_EXPIRES_IN=30d

# Google Gemini AI
GEMINI_API_KEY=AIzaSy...your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# Google OAuth 2.0 (Login Google)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_ID_ALT=

# Email SMTP (Nodemailer untuk OTP Lupa Password)
EMAIL_USER=emailanda@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx  # 16-digit Google App Password tanpa spasi

# Pusher Channels (Real-Time Chat)
PUSHER_APP_ID=your_pusher_app_id
PUSHER_KEY=your_pusher_key
PUSHER_SECRET=your_pusher_secret
PUSHER_CLUSTER=ap1

# Enkripsi Database Chat (AES-256-CBC, wajib tepat 32 karakter)
ENCRYPTION_KEY=dinoyocraft_secret_key_32_chars!
```

> [!TIP]
> - Untuk mendapatkan `EMAIL_PASS`, aktifkan *2-Step Verification* pada akun Google Anda, kemudian buka menu **App Passwords (Sandi Aplikasi)** dan buat sandi khusus untuk Nodemailer.
> - Kredensial Pusher dapat diambil langsung dari dashboard Pusher -> App Keys.

---

### 4. Setup & Migrasi Database Otomatis (1 Perintah)

1. Pastikan servis **MySQL** pada XAMPP/Laragon sudah berstatus **Running**.
2. Buat database bernama `dinoyocraft_db`:
   ```sql
   CREATE DATABASE dinoyocraft_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Jalankan migrasi otomatis:
   ```bash
   npm run migrate
   ```

> [!IMPORTANT]
> Skrip `npm run migrate` (`src/scripts/migrate.ts`) secara otomatis membuat seluruh **16 tabel relasional**, menyelaraskan kolom baru secara non-destruktif, serta mengisi data awal (*seed data* akun admin, kategori, profil mitra, master data, dan sampel produk). Skrip ini aman dijalankan berulang kali (*idempotent*).

---

## 🏃 Menjalankan Aplikasi

| Perintah | Deskripsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server dalam mode pengembangan dengan *hot-reload* (`tsx watch`) |
| `npm run migrate` | Menjalankan migrasi database dan sinkronisasi 16 tabel relasional |
| `npm run build` | Melakukan kompilasi kode TypeScript ke JavaScript di direktori `dist/` |
| `npm run start` | Menjalankan build produksi dari `dist/server.js` |
| `npm run type-check` | Memeriksa validitas tipe TypeScript tanpa melakukan kompilasi file |

Server default akan berjalan di:
```text
http://localhost:5000
```
Status server dapat diverifikasi melalui:
```text
GET http://localhost:5000/health
```

---

## 📑 Dokumentasi Endpoint API

Base URL: `http://localhost:5000/api`

### 1. Sistem & Kesehatan Server
| Method | Endpoint | Auth | Deskripsi |
| :--- | :--- | :---: | :--- |
| `GET` | `/health` | Publik | Cek status server, waktu aktif, dan environment |

### 2. Autentikasi & Akun (`/api/auth`) — *Zod Validated*
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `POST` | `/api/auth/register-mitra` | Publik | - | Pendaftaran toko mitra + upload KTP, NIB, & sampel foto |
| `POST` | `/api/auth/login` | Publik | - | Login mitra & pengguna via email & kata sandi |
| `POST` | `/api/auth/login-mitra` | Publik | - | Alias login khusus portal mitra |
| `POST` | `/api/auth/google-login` | Publik | - | Autentikasi menggunakan Google OAuth 2.0 Credential |
| `POST` | `/api/auth/forgot-password` | Publik | - | Mengirimkan 6-digit kode OTP ke email & DB |
| `POST` | `/api/auth/verify-otp` | Publik | - | Verifikasi kode OTP sebelum ubah kata sandi |
| `POST` | `/api/auth/reset-password` | Publik | - | Reset kata sandi baru setelah OTP valid |
| `GET` | `/api/auth/profile` | Bearer | All | Mengambil detail profil pengguna yang sedang login |
| `PUT` | `/api/auth/profile` | Bearer | All | Memperbarui profil akun (nama, telepon, avatar, banner) |
| `POST` | `/api/auth/reupload-docs` | Bearer | Mitra | Mengunggah ulang berkas KTP/NIB setelah perbaikan |

### 3. Buku Alamat Pengiriman (`/api/addresses`) — *Zod Validated*
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/addresses` | Bearer | All | Mengambil seluruh buku alamat pengiriman milik user |
| `GET` | `/api/addresses/:id` | Bearer | All | Detail satu alamat spesifik |
| `POST` | `/api/addresses` | Bearer | All | Menambahkan alamat baru |
| `PUT` | `/api/addresses/:id` | Bearer | All | Memperbarui alamat yang sudah ada |
| `DELETE` | `/api/addresses/:id` | Bearer | All | Menghapus alamat pengiriman |
| `PATCH` | `/api/addresses/:id/default`| Bearer | All | Menjadikan alamat sebagai alamat pengiriman utama |

### 4. Keranjang Belanja (`/api/cart`) — *Zod Validated*
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/cart` | Bearer | All | Mengambil seluruh item keranjang belanja user |
| `POST` | `/api/cart` | Bearer | All | Menambahkan produk & varian ke keranjang |
| `PUT` | `/api/cart/:id` | Bearer | All | Mengubah kuantitas atau varian produk di keranjang |
| `DELETE` | `/api/cart/:id` | Bearer | All | Menghapus satu item dari keranjang |
| `DELETE` | `/api/cart` | Bearer | All | Mengosongkan seluruh isi keranjang belanja |

### 5. Pesanan & Transaksi (`/api/orders`) — *Zod Validated*
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `POST` | `/api/orders/checkout` | Bearer | All | Checkout pesanan (otomatis potong stok & buat transaksi) |
| `GET` | `/api/orders` | Bearer | All | Riwayat transaksi & pesanan customer yang sedang login |
| `GET` | `/api/orders/mitra` | Bearer | Mitra/Admin | Daftar pesanan pelanggan yang masuk ke toko mitra |
| `GET` | `/api/orders/:id` | Bearer | All | Detail lengkap pesanan beserta rincian item & status |
| `PATCH` | `/api/orders/:id/status` | Bearer | Mitra/Admin | Memperbarui status pesanan (`paid`, `packed`, `shipped`, `completed`, `cancelled`) |

### 6. Ulasan & Penilaian Produk (`/api/reviews`) — *Zod Validated*
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/reviews/product/:productId` | Publik | - | Mengambil ulasan & statistik distribusi rating produk |
| `POST` | `/api/reviews` | Bearer | All | Mengirim ulasan produk (rating 1-5, foto, varian) |
| `POST` | `/api/reviews/:id/reply` | Bearer | Mitra/Admin | Mitra membalas ulasan yang diberikan pembeli |
| `PATCH` | `/api/reviews/:id/helpful` | Publik | - | Menambah jumlah vote tanggapan bermanfaat |

### 7. Pusat Notifikasi (`/api/notifications`)
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/notifications` | Bearer | All | Mengambil daftar notifikasi akun & jumlah unread |
| `PATCH` | `/api/notifications/:id/read` | Bearer | All | Menandai satu notifikasi telah dibaca |
| `PATCH` | `/api/notifications/read-all` | Bearer | All | Menandai semua notifikasi telah dibaca |
| `DELETE` | `/api/notifications/:id` | Bearer | All | Menghapus notifikasi |

### 8. Percakapan Real-Time & Terenkripsi (`/api/chat`) — *Zod Validated*
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `POST` | `/api/chat/send/:targetUserId` | Bearer | All | Mengirim pesan (dienkripsi AES-256 ke DB & ditrigger ke Pusher) |
| `GET` | `/api/chat/messages/:targetUserId` | Bearer | All | Mengambil riwayat pesan antara dua pengguna (otomatis didekripsi) |
| `GET` | `/api/chat/contacts` | Bearer | All | Mengambil daftar kontak percakapan, pratinjau pesan terakhir & jumlah unread |

### 9. Portal & Toko Mitra (`/api/mitra`)
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/mitra/dashboard` | Bearer | Mitra/Admin | Mengambil data ringkasan metrik dashboard mitra |
| `GET` | `/api/mitra/store-profile` | Bearer | Mitra | Mengambil informasi detail toko mitra yang sedang aktif |
| `GET` | `/api/mitra/orders` | Bearer | Mitra | Daftar pesanan masuk ke toko mitra |
| `GET` | `/api/mitra/finance` | Bearer | Mitra | Laporan rekapitulasi keuangan & transaksi toko |
| `PUT` | `/api/mitra/products/:id` | Bearer | Mitra | Memperbarui rincian produk keramik |

### 10. Katalog Produk (`/api/products`) — *Zod Validated*
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/products` | Bearer | Mitra | Mengambil katalog seluruh produk milik mitra terkait |
| `POST` | `/api/products` | Bearer | Mitra | Menambahkan produk keramik baru (dengan upload gambar) |
| `PUT` | `/api/products/:id` | Bearer | Mitra | Mengubah rincian produk (harga, stok, nama, kategori, varian) |
| `DELETE` | `/api/products/:id` | Bearer | Mitra | Menghapus produk dari katalog (soft delete) |

### 11. Panel Administrator (`/api/admin`) — *Zod Validated*
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/admin/dashboard-stats` | Publik / Bearer | Admin | Statistik global pengguna, omzet, dan transaksi sistem |
| `GET` | `/api/admin/users` | Bearer | Admin | Daftar seluruh pengguna (dengan paginasi & filter) |
| `PATCH` | `/api/admin/users/:id/status`| Bearer | Admin | Mengaktifkan atau menonaktifkan status akun pengguna |
| `GET` | `/api/admin/verifikasi` | Bearer | Admin | Melihat daftar pendaftaran toko mitra yang pending |
| `PATCH` | `/api/admin/verifikasi/:id` | Bearer | Admin | Menyetujui atau menolak permohonan toko mitra + alasan |
| `GET` | `/api/admin/master-data` | Bearer | Admin | Mengambil data konfigurasi master |
| `POST` | `/api/admin/master-data` | Bearer | Admin | Menambahkan konfigurasi data master baru |

### 12. Moderasi & Keamanan Admin (`/api/admin/moderation`) — *Zod Validated*
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/admin/moderation/reports` | Bearer | Admin | Daftar laporan pelanggaran (filter tipe, status, cari, paginasi) |
| `PUT` | `/api/admin/moderation/reports/:id/action` | Bearer | Admin | Tindakan laporan (`suspend` toko/produk, `hapus` ulasan, atau `abaikan`) |
| `GET` | `/api/admin/moderation/account-deletions` | Bearer | Admin | Daftar permohonan penghapusan akun customer |
| `PUT` | `/api/admin/moderation/account-deletions/:id/action` | Bearer | Admin | Setujui (`approved`) atau tolak (`rejected`) permohonan hapus akun |

### 13. Layanan Cerdas AI Gemini (`/api/ai`) — *Zod Validated*
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `POST` | `/api/ai/analyze` | Bearer | Mitra/Admin | Melakukan analisis pasar atau rekomendasi produk keramik |
| `GET` | `/api/ai/history` | Bearer | All | Mengambil riwayat konsultasi analisis AI milik pengguna |

---

## 🗄️ Gambaran 16 Tabel Basis Data Relasional

```text
users (id, name, email, password_hash, role, google_id, avatar_url, is_active, ...)
  ├── user_addresses (user_id -> users.id, recipient_name, full_address, city, postal_code, is_default, ...)
  ├── user_otps (user_id -> users.id, otp_code, otp_type, expires_at, is_used, ...)
  ├── mitra_profiles (user_id -> users.id, store_name, ktp, nib, is_verified, rejection_reason, rating, ...)
  │     ├── products (mitra_id -> mitra_profiles.id, category_id -> categories.id, weight_gram, variants, ...)
  │     │     ├── carts (product_id -> products.id, user_id -> users.id, variant, quantity, ...)
  │     │     ├── order_items (order_id -> orders.id, product_id -> products.id, variant, unit_price, ...)
  │     │     └── reviews (product_id -> products.id, user_id -> users.id, rating, seller_reply, ...)
  │     └── orders (mitra_id -> mitra_profiles.id, user_id -> users.id, address_id, transaction_id, status, ...)
  ├── transactions (user_id -> users.id, amount, status, reference_code, transaction_type, ...)
  ├── notifications (user_id -> users.id, title, message, type, is_read, ...)
  ├── messages (sender_id -> users.id, receiver_id -> users.id, message [encrypted AES-256], is_read, ...)
  ├── reports (reporter_id -> users.id, type, target_id, reason, status, ...)
  ├── account_deletions (user_id -> users.id, reason, status, requested_at, ...)
  ├── audit_logs (user_id -> users.id, action, table_name, old_values, new_values, ip_address, ...)
  ├── master_data (category, key, value, description, created_by -> users.id, ...)
  └── ai_analysis_results (user_id -> users.id, prompt_context, ai_response, ...)
```

---

## 📂 Struktur Direktori Proyek

```plaintext
DinoyoCraftBE/
├── assets/                     # Aset statis & logo DinoyoCraft untuk template email
│   └── logo.png                # Logo resmi untuk lampiran inline email (CID)
├── database/                   # Master DDL SQL lengkap & cadangan import manual
│   └── schema.sql              # Master skema MySQL & seed data awal
├── dist/                       # Output kompilasi TypeScript (produksi)
├── src/
│   ├── config/                 # Konfigurasi koneksi MySQL pool & env
│   │   └── database.ts
│   ├── controllers/            # Penanganan logika bisnis API
│   │   ├── addressController.ts      # Logic buku alamat pengiriman
│   │   ├── adminController.ts        # Logic kontrol & verifikasi admin
│   │   ├── aiController.ts           # Logic konsultasi Google Gemini AI
│   │   ├── authController.ts         # Logic autentikasi, JWT, OTP, & profil
│   │   ├── cartController.ts         # Logic keranjang belanja customer
│   │   ├── chatController.ts         # Logic chat Pusher & enkripsi AES-256
│   │   ├── mitraController.ts        # Logic dashboard toko mitra
│   │   ├── moderationController.ts   # Logic moderasi laporan & hapus akun
│   │   ├── notificationController.ts # Logic pusat notifikasi akun
│   │   ├── orderController.ts        # Logic pesanan, checkout, & transaksi
│   │   ├── productController.ts      # Logic katalog & stok produk
│   │   ├── reviewController.ts       # Logic ulasan bintang & balasan toko
│   │   └── storeController.ts        # Logic profil publik toko
│   ├── middlewares/            # Middleware Express
│   │   ├── auditMiddleware.ts        # Logger jejak aktivitas sistem
│   │   ├── authMiddleware.ts         # JWT verifyToken, requireRole, isAdmin
│   │   ├── errorMiddleware.ts        # Error handler & 404 handler
│   │   ├── uploadMiddleware.ts       # Upload gambar & berkas Multer
│   │   └── validatorMiddleware.ts    # Zod fail-fast schema validator middleware
│   ├── routes/                 # Definisi rute modular API
│   │   ├── addressRoutes.ts
│   │   ├── adminRoutes.ts
│   │   ├── aiRoutes.ts
│   │   ├── authRoutes.ts
│   │   ├── cartRoutes.ts
│   │   ├── chatRoutes.ts
│   │   ├── mitraRoutes.ts
│   │   ├── moderationRoutes.ts
│   │   ├── notificationRoutes.ts
│   │   ├── orderRoutes.ts
│   │   ├── productRoutes.ts
│   │   ├── reviewRoutes.ts
│   │   └── index.ts                  # Central router
│   ├── scripts/                # Otomasi & skrip migrasi
│   │   └── migrate.ts                # DDL 16 tabel & seeding data otomatis
│   ├── types/                  # Deklarasi tipe TypeScript custom
│   ├── utils/                  # Utilitas helper
│   │   ├── encryption.ts             # Enkripsi & dekripsi pesan AES-256-CBC
│   │   ├── piiAnonymizer.ts
│   │   ├── pusher.ts                 # Inisialisasi Pusher Server SDK
│   │   └── response.ts               # Standarisasi format respons JSON
│   ├── validators/             # Skema validasi Zod
│   │   └── schemas.ts                # Skema Zod lengkap untuk seluruh rute
│   ├── app.ts                  # Inisialisasi Express, Helmet, CORS, & Rate Limit
│   └── server.ts               # Entry point server (port listener)
├── uploads/                    # Penyimpanan berkas statis & media lokal
├── .env.example                # Template variabel lingkungan
├── package.json                # Daftar pustaka & skrip proyek
├── tsconfig.json               # Konfigurasi compiler TypeScript
└── README.md                   # Dokumentasi proyek
```

---

## 🔒 Praktik Keamanan & Git Workflow

1. **Jaga Kerahasiaan Berkas `.env`**: Jangan pernah mengunggah file `.env` ke GitHub atau sistem kendali versi lainnya.
2. **Kunci Enkripsi `ENCRYPTION_KEY`**: Pastikan kunci enkripsi selalu memiliki panjang tepat 32 karakter dan tidak diubah sembarangan di lingkungan produksi agar riwayat chat lama tetap dapat didekripsi.
3. **Migrasi Rutin**: Selalu jalankan `npm run migrate` setiap kali selesai melakukan `git pull` agar tabel, kolom baru, dan referensi selalu mutakhir.
4. **Format Tanggapan API**: Seluruh tanggapan JSON standar mengadopsi format:
   ```json
   {
     "success": true,
     "message": "Pesan status deskriptif",
     "data": {}
   }
   ```
5. **Git Workflow**:
   - Branch **`ali`**: Branch pengembangan fitur aktif. Seluruh pembaruan backend dikerjakan dan di-push ke branch ini.
   - Branch **`main`**: Branch rilis produksi stabil.
