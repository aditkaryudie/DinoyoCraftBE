# 🏺 DinoyoCraft Backend API

Repositori *backend* untuk **DinoyoCraft**, platform *e-commerce multi-vendor* dan wisata edukasi keramik Kampung Wisata Keramik Dinoyo. Dibangun menggunakan Express.js, TypeScript, dan MySQL.

## 👥 Tim Pengembang (Kelompok 1 - Kelas T3C)
* **Aditya Karyudie** (253140701111017)
* **Mochammad Al Mizan Ya Hafidl** (253140701111026)
* **Moh Ali Farda Al Ghifari** (253140701111042)

---

## 💻 Teknologi yang Digunakan
* **Runtime:** Node.js (v20 atau lebih baru)
* **Framework:** Express.js
* **Bahasa:** TypeScript (dijalankan via `tsx`)
* **Database:** MySQL
* **Autentikasi:** JWT & Google OAuth
* **Mailer:** Nodemailer (Gmail SMTP)

---

## 🚀 Panduan Instalasi (Local Development)

### 1. Clone Repositori
```bash
git clone https://github.com/USERNAME_KAMU/DinoyoCraftBE.git
cd DinoyoCraftBE
```

### 2. Install Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment
Salin file `.env.example` menjadi `.env` dan sesuaikan dengan konfigurasi lokal Anda:

```bash
cp .env.example .env
```

Isi minimal yang perlu diisi di `.env`:
```
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=dinoyocraft
JWT_SECRET=rahasia_and
```

### 4. Setup Database
1. Buat database MySQL baru, misal `dinoyocraft`.
2. Import file SQL dasar (schema dan data awal) ke database yang baru dibuat.

### 5. Jalankan Server
```bash
npm run dev
```
Server akan berjalan di `http://localhost:3000`.

---

## 🔄 Sinkronisasi Kolom Terbaru (Migrasi)

Setelah database dasar ter-import, **tidak perlu lagi import/export file `.sql` secara manual** jika ada penambahan kolom baru (misalnya kolom profil toko mitra).

Cukup buka terminal di VS Code dan jalankan perintah berikut:

```bash
npx tsx src/scripts/migrate.ts
```

Skrip ini akan memeriksa dan menambahkan kolom yang belum ada di tabel database agar sesuai dengan skema terbaru.

---

## 📂 Struktur Folder

```text
src/
  controllers/   # Logika bisnis endpoint
  routes/        # Definisi rute API
  models/        # Model dan query database
  middleware/    # Middleware (auth, validasi, dll.)
  scripts/       # Skrip utilitas (mis. migrate.ts)
  config/        # Konfigurasi (db, env, dll.)
```

---

## 📝 Lisensi

MIT License
