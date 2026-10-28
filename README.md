# 🏺 DinoyoCraft — Backend RESTful API

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v20+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-5.x-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/MySQL-8.x-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL" />
  <img src="https://img.shields.io/badge/Pusher-Channels-9B51E0?style=for-the-badge&logo=pusher&logoColor=white" alt="Pusher" />
  <img src="https://img.shields.io/badge/Google_Gemini_AI-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Google Gemini" />
</p>

Backend RESTful API untuk **DinoyoCraft**, platform e-commerce multi-vendor, katalog produk, dan wisata edukasi keramik khas **Kampung Wisata Keramik Dinoyo, Kota Malang**. Layanan backend ini menangani seluruh logika bisnis, manajemen peran (RBAC), autentikasi ganda (JWT & Google OAuth), obrolan real-time via Pusher dengan enkripsi database (AES-256-CBC), panel moderasi dan keamanan admin, penyimpanan media lokal, asisten cerdas berbasis Google Gemini AI, hingga audit logging otomatis.

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
- 💬 **Sistem Chat Real-Time & Enkripsi Data (Pusher & AES-256-CBC)**:
  - Komunikasi obrolan real-time berlatensi rendah menggunakan **Pusher Channels**.
  - **Enkripsi Simetris AES-256-CBC** pada penyimpanan pesan di database untuk menjaga privasi percakapan.
  - Dekripsi otomatis saat pesan diambil oleh pengguna terautentikasi (`getMessages` / `getChatHistory`).
  - Daftar kontak percakapan real-time dengan pratinjau pesan terakhir dan indikator pesan belum dibaca (*unread count*).
- 🛡️ **Panel Kontrol Admin & Sistem Moderasi Terpadu**:
  - Ringkasan statistik performa platform secara real-time.
  - Verifikasi pendaftaran toko mitra (Setujui / Tolak).
  - Manajemen akun pengguna (aktivasi / penonaktifan akun).
  - **Moderasi & Keamanan**:
    - **Tab 1 — Laporan Pelanggaran**: Penanganan aduan terhadap Toko, Produk, dan Ulasan dengan aksi suspend toko/produk, hapus konten ulasan, atau abaikan laporan.
    - **Tab 2 — Pengajuan Hapus Akun**: Persetujuan atau penolakan pengajuan penghapusan akun customer secara terpusat.
  - Konfigurasi Data Master dinamis (kategori produk, status transaksi, dll.).
- 🏪 **Portal & Manajemen Mitra**:
  - Registrasi calon mitra lengkap dengan verifikasi berkas (KTP, NIB, & sampel foto karya).
  - Profil toko (nama toko, deskripsi, alamat workshop, sosial media, avatar, dan banner).
  - Manajemen katalog produk (tambah, edit, soft delete, kelola varian & stok).
  - Monitoring pesanan & laporan finansial mitra.
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

### 1. Clone Repositori
```bash
git clone https://github.com/USERNAME_KAMU/DinoyoCraftBE.git
cd DinoyoCraftBE
```

### 2. Install Dependensi
```bash
npm install
```

Jika menginstal library Pusher secara manual:
```bash
# Instalasi Pusher Server SDK untuk Backend
npm install pusher
```

> [!NOTE]
> Di sisi Frontend (Next.js), library client yang dipasang adalah:
> ```bash
> npm install pusher-js
> ```

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

### 4. Setup & Migrasi Database Otomatis

1. Pastikan servis **MySQL** pada XAMPP/Laragon sudah berstatus **Running**.
2. Buat database bernama `dinoyocraft_db`:
   ```sql
   CREATE DATABASE dinoyocraft_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Jalankan skrip migrasi otomatis dari terminal backend:
   ```bash
   npx tsx src/scripts/migrate.ts
   ```

> [!IMPORTANT]
> Skrip `migrate.ts` akan otomatis mengeksekusi pembuatan seluruh tabel berelasi (`users`, `mitra_profiles`, `products`, `messages`, `reports`, `account_deletions`, dll.) dan mengisi data awal (*seed data* akun admin, kategori, profil mitra, dan sampel produk). Skrip ini aman dijalankan berulang kali (*idempotent*).

---

## 📡 Setup & Konfigurasi Pusher (Real-Time WebSockets)

Untuk mengaktifkan fitur chat real-time interaktif antara pengguna, mitra, dan admin:

### 1. Buat Aplikasi di Pusher Channels
1. Buat akun atau login ke [dashboard Pusher](https://dashboard.pusher.com/).
2. Buat aplikasi baru (**Create app**) dengan nama misalnya `dinoyocraft-chat`.
3. Pilih cluster server terdekat, direkomendasikan **`ap1` (Asia Pacific - Singapore)**.

### 2. Instalasi Paket Pusher
- **Backend (Express)**:
  ```bash
  npm install pusher
  ```
- **Frontend (Next.js)**:
  ```bash
  npm install pusher-js
  ```

### 3. Masukkan Kredensial ke `.env`
Buka tab **App Keys** pada aplikasi Pusher Anda, lalu salin kuncinya ke file `.env` di backend:
```env
PUSHER_APP_ID=your_pusher_app_id
PUSHER_KEY=your_pusher_key
PUSHER_SECRET=your_pusher_secret
PUSHER_CLUSTER=ap1
```

### 4. Arsitektur Channel & Event
- **Channel Percakapan Unik (2 Arah)**: `chat-{minId}-{maxId}` (contoh: percakapan user id `1` dan `39` menggunakan channel `chat-1-39`).
- **Channel Notifikasi Personal User**: `user-{targetUserId}` (contoh: `user-39` dan `user-1`).
- **Nama Event**: `new-message`.
- **Payload Real-Time**: Pesan ditransmisikan dalam format teks asli melalui enkripsi bawaan TLS Pusher (WebSockets secure `wss://`), sedangkan di penyimpanan database MySQL disimpan dalam bentuk ciphertext terenkripsi algoritma **AES-256-CBC**.

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

### 3. Percakapan Real-Time & Terenkripsi (`/api/chat`)
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `POST` | `/api/chat/send/:targetUserId` | Bearer | All | Mengirim pesan (dienkripsi AES-256 ke DB & ditrigger ke Pusher) |
| `GET` | `/api/chat/messages/:targetUserId` | Bearer | All | Mengambil riwayat pesan antara dua pengguna (otomatis didekripsi) |
| `GET` | `/api/chat/contacts` | Bearer | All | Mengambil daftar kontak percakapan, pratinjau pesan terakhir & jumlah unread |

### 4. Portal Mitra (`/api/mitra`)
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/mitra/dashboard` | Bearer | Mitra/Admin | Mengambil data ringkasan metrik dashboard mitra |
| `GET` | `/api/mitra/store-profile` | Bearer | Mitra | Mengambil informasi detail toko mitra yang sedang aktif |
| `GET` | `/api/mitra/orders` | Bearer | Mitra | Daftar pesanan masuk ke toko mitra |
| `GET` | `/api/mitra/finance` | Bearer | Mitra | Laporan rekapitulasi keuangan & transaksi toko |
| `PUT` | `/api/mitra/products/:id` | Bearer | Mitra | Memperbarui rincian produk keramik |

### 5. Manajemen Produk (`/api/products`)
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/products` | Bearer | Mitra | Mengambil katalog seluruh produk milik mitra terkait |
| `POST` | `/api/products` | Bearer | Mitra | Menambahkan produk keramik baru (dengan upload gambar) |
| `PUT` | `/api/products/:id` | Bearer | Mitra | Mengubah rincian produk (harga, stok, nama, kategori) |
| `DELETE` | `/api/products/:id` | Bearer | Mitra | Menghapus produk dari katalog (soft delete) |

### 6. Panel Administrator (`/api/admin`)
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/admin/dashboard-stats` | Publik / Bearer | Admin | Statistik global pengguna, omzet, dan transaksi sistem |
| `GET` | `/api/admin/users` | Bearer | Admin | Daftar seluruh pengguna (dengan paginasi & filter) |
| `PATCH` | `/api/admin/users/:id/status`| Bearer | Admin | Mengaktifkan atau menonaktifkan status akun pengguna |
| `GET` | `/api/admin/verifikasi` | Bearer | Admin | Melihat daftar pendaftaran toko mitra yang pending |
| `PATCH` | `/api/admin/verifikasi/:id` | Bearer | Admin | Menyetujui atau menolak permohonan toko mitra |
| `GET` | `/api/admin/master-data` | Bearer | Admin | Mengambil data konfigurasi master |
| `POST` | `/api/admin/master-data` | Bearer | Admin | Menambahkan konfigurasi data master baru |

### 7. Moderasi & Keamanan Admin (`/api/admin/moderation`)
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/admin/moderation/reports` | Bearer | Admin | Daftar laporan pelanggaran (filter tipe, status, cari, paginasi) |
| `PUT` | `/api/admin/moderation/reports/:id/action` | Bearer | Admin | Tindakan laporan (`suspend` toko/produk, `hapus` ulasan, atau `abaikan`) |
| `GET` | `/api/admin/moderation/account-deletions` | Bearer | Admin | Daftar permohonan penghapusan akun customer |
| `PUT` | `/api/admin/moderation/account-deletions/:id/action` | Bearer | Admin | Setujui (`approved`) atau tolak (`rejected`) permohonan hapus akun |

### 8. Layanan Cerdas AI Gemini (`/api/ai`)
| Method | Endpoint | Auth | Role | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `POST` | `/api/ai/analyze` | Bearer | Mitra/Admin | Melakukan analisis pasar atau rekomendasi produk keramik |
| `GET` | `/api/ai/history` | Bearer | All | Mengambil riwayat konsultasi analisis AI milik pengguna |

---

## 🗄️ Gambaran Skema Basis Data

```text
users (id, name, email, password_hash, role, google_id, avatar_url, is_active, ...)
  ├── user_addresses (user_id -> users.id)
  ├── mitra_profiles (user_id -> users.id, store_name, ktp, nib, is_verified, is_active, ...)
  │     ├── products (mitra_id -> mitra_profiles.id, category_id -> categories.id)
  │     │     ├── order_items (product_id -> products.id)
  │     │     └── carts (product_id -> products.id, user_id -> users.id)
  │     └── orders (mitra_id -> mitra_profiles.id, user_id -> users.id, transaction_id -> transactions.id)
  ├── messages (sender_id -> users.id, receiver_id -> users.id, message [encrypted AES-256], is_read, ...)
  ├── reports (reporter_id, reporter_name, type, target_id, target_name, reason, status, resolved_at, ...)
  ├── account_deletions (user_id, name, email, reason, status, resolved_at, ...)
  ├── transactions (user_id -> users.id, amount, status, reference_code, ...)
  ├── ai_analysis_results (user_id -> users.id, prompt_context, ai_response, ...)
  ├── audit_logs (user_id -> users.id, action, table_name, old_values, new_values, ...)
  └── educational_tours (created_by -> users.id)
```

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
│   │   ├── chatController.ts    # Logic chat Pusher & enkripsi/dekripsi AES-256
│   │   ├── mitraController.ts
│   │   ├── moderationController.ts # Logic moderasi laporan & hapus akun
│   │   ├── productController.ts
│   │   └── storeController.ts
│   ├── middlewares/            # Middleware Express (Auth, Upload, Logger, Validasi)
│   │   ├── auditMiddleware.ts
│   │   ├── authMiddleware.ts   # JWT verifyToken, requireRole, isAdmin
│   │   ├── errorMiddleware.ts
│   │   ├── uploadMiddleware.ts
│   │   └── validatorMiddleware.ts
│   ├── routes/                 # Definisi rute modular API
│   │   ├── adminRoutes.ts
│   │   ├── aiRoutes.ts
│   │   ├── authRoutes.ts
│   │   ├── chatRoutes.ts       # Rute chat real-time
│   │   ├── mitraRoutes.ts
│   │   ├── moderationRoutes.ts # Rute moderasi admin
│   │   ├── productRoutes.ts
│   │   └── index.ts            # Central router
│   ├── scripts/                # Otomasi & skrip migrasi
│   │   └── migrate.ts
│   ├── types/                  # Deklarasi tipe TypeScript custom
│   ├── utils/                  # Utilitas helper
│   │   ├── encryption.ts       # Enkripsi & dekripsi pesan AES-256-CBC
│   │   ├── piiAnonymizer.ts
│   │   └── response.ts
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
2. **Kunci Enkripsi `ENCRYPTION_KEY`**: Pastikan kunci enkripsi selalu memiliki panjang tepat 32 karakter dan tidak diubah sembarangan di lingkungan produksi agar riwayat chat lama tetap dapat didekripsi.
3. **Migrasi Rutin**: Selalu jalankan `npx tsx src/scripts/migrate.ts` setiap kali selesai melakukan `git pull` agar tabel dan referensi selalu mutakhir.
4. **Format Tanggapan API**: Seluruh tanggapan JSON standar mengadopsi format:
   ```json
   {
     "success": true,
     "message": "Pesan status deskriptif",
     "data": {}
   }
   ```
5. **Git Workflow**: Gunakan pesan commit yang deskriptif dan buat branch terpisah saat mengerjakan fitur baru sebelum menggabungkannya (*merge*) ke branch utama.
