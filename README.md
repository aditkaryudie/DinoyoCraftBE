🏺 DinoyoCraft Backend API

Repositori backend untuk DinoyoCraft, platform e-commerce multi-vendor dan wisata edukasi keramik Kampung Wisata Keramik Dinoyo. Dibangun menggunakan Express.js, TypeScript, dan MySQL.

👥 Tim Pengembang (Kelompok 1 - Kelas T3C)

Aditya Karyudie (253140701111017)

Mochammad Al Mizan Ya Hafidl (253140701111026)

Moh Ali Farda Al Ghifari (253140701111042)

💻 Teknologi yang Digunakan

Runtime: Node.js (v20 atau lebih baru)

Framework: Express.js

Bahasa: TypeScript (dijalankan via tsx)

Database: MySQL

Autentikasi: JWT & Google OAuth

Mailer: Nodemailer (Gmail SMTP)

🚀 Panduan Instalasi (Local Development)

Prasyarat

Sebelum memulai, pastikan perangkat Anda telah terpasang:

Node.js (versi 20 ke atas)

Git

XAMPP / Laragon (atau server MySQL lokal lainnya)

1. Clone Repositori

Jalankan perintah berikut di terminal Anda untuk mengunduh kode sumber:

git clone https://github.com/USERNAME_KAMU/DinoyoCraftBE.git
cd DinoyoCraftBE


2. Install Dependensi

Unduh dan pasang semua paket yang dibutuhkan oleh proyek:

npm install


3. Konfigurasi Environment Variables (.env)

Buat file bernama .env di root directory (sejajar dengan package.json). Jangan pernah melakukan commit file ini ke GitHub. Salin dan sesuaikan variabel berikut:

# Server
PORT=5000
NODE_ENV=development

# Database MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD= # Kosongkan jika XAMPP default, atau isi sesuai password lokalmu
DB_NAME=dinoyocraft_db

# JWT & Auth
JWT_SECRET=rahasia_jwt_kalian
GOOGLE_CLIENT_ID=client_id_google_kalian
GOOGLE_CLIENT_ID_ALT=client_id_google_alternatif

# SMTP Email (Nodemailer - Lupa Password)
EMAIL_USER=email_pengirim@gmail.com
EMAIL_PASS=16_digit_app_password_tanpa_spasi


4. Setup & Sinkronisasi Database

Pastikan server MySQL Anda (melalui XAMPP/Laragon) sudah menyala. Berikut adalah langkah-langkah untuk menyiapkan database:

A. Membuat Database

Buka phpMyAdmin di browser (biasanya di http://localhost/phpmyadmin).

Buat database baru (kosong) dengan nama persis: dinoyocraft_db.

B. Membangun Struktur dan Data (Migrasi Otomatis)
Anda tidak perlu mengimpor file .sql secara manual. Setelah membuat database kosong di atas, buka terminal di VS Code dan jalankan perintah ini:

npx tsx src/scripts/migrate.ts


(⚠️ Catatan Penting Tim: Skrip ini wajib dijalankan oleh semua anggota tim saat pertama kali setup dan setiap kali sehabis melakukan git pull dari GitHub. Skrip ini akan otomatis membangun struktur tabel dan mengisi data awal agar struktur database kalian selalu sinkron dengan versi terbaru).

5. Jalankan Server

Untuk menyalakan server dalam mode development (akan auto-reload jika ada perubahan file):

npm run dev


Server backend akan berjalan di http://localhost:5000.

📂 Struktur Folder Utama

src/
  controllers/   # Logika pemrosesan API (Auth, Mitra, dll.)
  routes/        # Pengaturan endpoint API
  middlewares/   # Middleware untuk verifikasi token, upload file, dll.
  config/        # Konfigurasi koneksi database
  scripts/       # Skrip utilitas (seperti migrasi database)
uploads/         # Direktori penyimpanan gambar lokal (avatar, banner toko)
