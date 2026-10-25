# 🏺 DinoyoCraft — Backend RESTful API

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v20+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-5.x-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/MySQL-8.x-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL" />
  <img src="https://img.shields.io/badge/Google_Gemini_AI-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Google Gemini" />
</p>

Backend RESTful API untuk **DinoyoCraft**, platform e-commerce multi-vendor, katalog produk, dan wisata edukasi keramik khas **Kampung Wisata Keramik Dinoyo, Kota Malang**. Layanan backend ini menangani seluruh logika bisnis, manajemen peran (RBAC), autentikasi ganda (JWT & Google OAuth), penyimpanan media lokal, asisten cerdas berbasis Google Gemini AI, hingga audit logging otomatis.

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
  - Alur Lupa Password & Verifikasi OTP 6-digit via SMTP Gmail (Nodemailer).
- 🏪 **Portal & Manajemen Mitra**:
  - Registrasi calon mitra lengkap dengan verifikasi berkas (KTP, NIB, & sampel foto karya).
  - Profil toko (nama toko, deskripsi, alamat workshop, sosial media, avatar, dan banner).
  - Manajemen katalog produk (tambah, edit, soft delete, kelola varian & stok).
  - Monitoring pesanan & laporan finansial mitra.
- 🛡️ **Panel Kontrol Admin**:
  - Ringkasan statistik performa platform secara real-time.
  - Verifikasi pendaftaran toko mitra (Setujui / Tolak).
  - Manajemen akun pengguna (aktivasi / penonaktifan akun).
  - Konfigurasi Data Master dinamis (kategori produk, status transaksi, dll.).
- 🤖 **Integrasi Google Gemini AI**:
  - Analisis strategi bisnis, rekomendasi harga, dan tren keramik untuk pengrajin Dinoyo.
  - Penyimpanan riwayat konsultasi AI ke database (`ai_analysis_results`).
- 📂 **Manajemen Media & File Statis**:
  - Upload berkas dan foto produk yang aman via Multer.
  - Penyajian file statis langsung melalui endpoint `/uploads`.
- 🛡️ **Keamanan & Logging**:
  - Proteksi header HTTP (`nosniff`, `DENY` framing, XSS protection).
  - Global error handling terpusat & penanganan rute 404.
  - Audit logging non-blocking untuk memantau perubahan data sensitif.

---

## 💻 Tech Stack & Pustaka

| Kategori | Teknologi / Library |
| :--- | :--- |
| **Runtime Environment** | [Node.js](https://nodejs.org/) (v20 ke atas) |
| **Framework** | [Express.js](https://expressjs.com/) (v5.x) |
| **Bahasa Pemrograman** | [TypeScript](https://www.typescriptlang.org/) (v5.x) via `tsx` |
| **Database** | [MySQL 8.x](https://www.mysql.com/) (Koneksi pool via `mysql2`) |
| **AI Engine** | [@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai) (Google Gemini Flash) |
| **Autentikasi & Enkripsi** | `jsonwebtoken`, `google-auth-library`, `bcryptjs` |
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

---

## 🚀 Panduan Instalasi & Setup Lokal

### 1. Clone Repositori
```bash
git clone https://github.com/USERNAME_KAMU/DinoyoCraftBE.git
cd DinoyoCraftBE
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
```

> [!TIP]
> Untuk mendapatkan `EMAIL_PASS`, aktifkan *2-Step Verification* pada akun Google Anda, kemudian buka menu **App Passwords (Sandi Aplikasi)** dan buat sandi khusus untuk Nodemailer.

---

### 4. Setup & Migrasi Database Otomatis

1. Pastikan servis **MySQL** pada XAMPP/Laragon sudah berstatus **Running**.
2. Buka **phpMyAdmin** (`http://localhost/phpmyadmin`) atau GUI database favorit Anda.
3. Buat database baru bernama persis:
   ```sql
   CREATE DATABASE dinoyocraft_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
4. Jalankan skrip migrasi otomatis dari terminal backend:
   ```bash
   npx tsx src/scripts/migrate.ts
   ```

> [!IMPORTANT]
> Skrip `migrate.ts` akan otomatis mengeksekusi pembuatan seluruh tabel berelasi (DDL) dan mengisi data dasar (*seed data* akun admin, kategori, profil mitra, dan sampel produk). Skrip ini aman dijalankan ulang (*idempotent*).

---

## 🏃 Menjalankan Aplikasi

| Perintah | Deskripsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server dalam mode pengembangan dengan *hot-reload* (`tsx watch`) |
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
| `GET` | `/health` | Publik | Cek kesehatan server backend & waktu aktif |

### 2. Autentikasi & Akun (`/api/auth`)
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `POST` | `/api/auth/register-mitra` | Publik | - | Pendaftaran toko mitra + upload KTP, NIB, & sampel foto |
| `POST` | `/api/auth/login` | Publik | - | Login mitra & pengguna via email & kata sandi |
| `POST` | `/api/auth/login-mitra` | Publik | - | Alias login khusus portal mitra |
| `POST` | `/api/auth/google-login` | Publik | - | Autentikasi menggunakan Google OAuth 2.0 Credential |
| `POST` | `/api/auth/forgot-password` | Publik | - | Mengirimkan 6-digit kode OTP ke email terdaftar |
| `POST` | `/api/auth/verify-otp` | Publik | - | Verifikasi kode OTP sebelum ubah kata sandi |
| `POST` | `/api/auth/reset-password` | Publik | - | Reset kata sandi baru setelah OTP valid |
| `GET` | `/api/auth/profile` | Bearer | All | Mengambil detail profil pengguna yang sedang login |
| `PUT` | `/api/auth/profile` | Bearer | All | Memperbarui profil akun (nama, telepon, avatar, banner) |

### 3. Portal Mitra (`/api/mitra`)
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/mitra/dashboard` | Bearer | Mitra/Admin | Mengambil data ringkasan metrik dashboard mitra |
| `GET` | `/api/mitra/store-profile` | Bearer | Mitra | Mengambil informasi detail toko mitra yang sedang aktif |
| `GET` | `/api/mitra/orders` | Bearer | Mitra | Daftar pesanan masuk ke toko mitra |
| `GET` | `/api/mitra/finance` | Bearer | Mitra | Laporan rekapitulasi keuangan & transaksi toko |
| `PUT` | `/api/mitra/products/:id` | Bearer | Mitra | Memperbarui rincian produk keramik |

### 4. Manajemen Produk (`/api/products`)
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/products` | Bearer | Mitra | Mengambil katalog seluruh produk milik mitra terkait |
| `POST` | `/api/products` | Bearer | Mitra | Menambahkan produk keramik baru (dengan upload gambar) |
| `PUT` | `/api/products/:id` | Bearer | Mitra | Mengubah rincian produk (harga, stok, nama, kategori) |
| `DELETE` | `/api/products/:id` | Bearer | Mitra | Menghapus produk dari katalog (soft delete) |

### 5. Panel Administrator (`/api/admin`)
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/admin/dashboard-stats` | Publik / Bearer | Admin | Statistik global pengguna, omzet, dan transaksi sistem |
| `GET` | `/api/admin/users` | Bearer | Admin | Daftar seluruh pengguna (dengan paginasi & filter) |
| `PATCH` | `/api/admin/users/:id/status`| Bearer | Admin | Mengaktifkan atau menonaktifkan status akun pengguna |
| `GET` | `/api/admin/verifikasi` | Bearer | Admin | Melihat daftar pendaftaran toko mitra yang pending |
| `PATCH` | `/api/admin/verifikasi/:id` | Bearer | Admin | Menyetujui atau menolak permohonan toko mitra |
| `GET` | `/api/admin/master-data` | Bearer | Admin | Mengambil data konfigurasi master |
| `POST` | `/api/admin/master-data` | Bearer | Admin | Menambahkan konfigurasi data master baru |

### 6. Layanan Cerdas AI Gemini (`/api/ai`)
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `POST` | `/api/ai/analyze` | Bearer | Mitra/Admin | Melakukan analisis pasar atau rekomendasi produk keramik |
| `GET` | `/api/ai/history` | Bearer | All | Mengambil riwayat konsultasi analisis AI milik pengguna |

---

## 🗄️ Gambaran Skema Basis Data

```text
users (id, name, email, password_hash, role, google_id, avatar_url, ...)
  ├── user_addresses (user_id -> users.id)
  ├── mitra_profiles (user_id -> users.id, store_name, ktp, nib, is_verified, ...)
  │     ├── products (mitra_id -> mitra_profiles.id, category_id -> categories.id)
  │     │     ├── order_items (product_id -> products.id)
  │     │     └── carts (product_id -> products.id, user_id -> users.id)
  │     └── orders (mitra_id -> mitra_profiles.id, user_id -> users.id, transaction_id -> transactions.id)
  ├── transactions (user_id -> users.id, amount, status, reference_code, ...)
  ├── ai_analysis_results (user_id -> users.id, prompt_context, ai_response, ...)
  ├── audit_logs (user_id -> users.id, action, table_name, old_values, new_values, ...)
  └── educational_tours (created_by -> users.id)
```

Detail spesifikasi tipe data, relasi kunci asing, dan indeks lengkap dapat dilihat pada [DATABASE_SCHEMA.md](file:///c:/DinoyoCraft/cobabe/DinoyoCraft/DinoyoCraftBE/database/DATABASE_SCHEMA.md).

---

## 📂 Struktur Direktori Proyek

```plaintext
DinoyoCraftBE/
├── database/                   # Skrip & dokumentasi skema database
│   ├── DATABASE_SCHEMA.md      # Kamus data lengkap
│   ├── migration_*.sql         # File DDL SQL referensi
│   └── schema.sql              # Struktur awal database
├── dist/                       # Output kompilasi TypeScript (produksi)
├── src/
│   ├── config/                 # Konfigurasi koneksi MySQL pool & env
│   │   └── database.ts
│   ├── controllers/            # Penanganan logika bisnis API
│   │   ├── adminController.ts
│   │   ├── aiController.ts
│   │   ├── authController.ts
│   │   ├── mitraController.ts
│   │   ├── productController.ts
│   │   └── storeController.ts
│   ├── middlewares/            # Middleware Express (Auth, Upload, Logger, Validasi)
│   │   ├── auditMiddleware.ts
│   │   ├── authMiddleware.ts
│   │   ├── errorMiddleware.ts
│   │   ├── uploadMiddleware.ts
│   │   └── validatorMiddleware.ts
│   ├── routes/                 # Definisi rute modular API
│   │   ├── adminRoutes.ts
│   │   ├── aiRoutes.ts
│   │   ├── authRoutes.ts
│   │   ├── mitraRoutes.ts
│   │   ├── productRoutes.ts
│   │   └── index.ts
│   ├── scripts/                # Otomasi & skrip migrasi
│   │   └── migrate.ts
│   ├── types/                  # Deklarasi tipe TypeScript custom
│   ├── utils/                  # Utilitas helper (JWT, hash, respons format)
│   ├── app.ts                  # Inisialisasi Express & konfigurasi global
│   └── server.ts               # Entry point server (port listener)
├── uploads/                    # Penyimpanan berkas statis & media lokal
├── .env.example                # Template variabel lingkungan
├── package.json                # Daftar pustaka & skrip proyek
├── tsconfig.json               # Konfigurasi compiler TypeScript
└── README.md                   # Dokumentasi proyek
```

---

## 🔒 Praktik Keamanan & Kontribusi

1. **Jaga Kerahasiaan Berkas `.env`**: Jangan pernah mengunggah file `.env` ke GitHub atau sistem kendali versi lainnya.
2. **Migrasi Rutin**: Selalu jalankan `npx tsx src/scripts/migrate.ts` setiap kali selesai melakukan `git pull` agar tabel dan referensi selalu mutakhir.
3. **Format Tanggapan API**: Seluruh tanggapan JSON standar mengadopsi format:
   ```json
   {
     "success": true,
     "message": "Pesan status deskriptif",
     "data": {}
   }
   ```
4. **Git Workflow**: Gunakan pesan commit yang deskriptif dan buat branch terpisah saat mengerjakan fitur baru sebelum menggabungkannya (*merge*) ke branch utama.

---
