# Database Schema — DinoyoCraft

**Database:** `dinoyocraft_db`  
**Engine:** InnoDB  
**Charset:** `utf8mb4` / `utf8mb4_unicode_ci`  
**DBMS:** MySQL 8.x

---

## Daftar Tabel

| No | Tabel | Deskripsi |
|----|-------|-----------|
| 1 | [`users`](#1-users) | Akun pengguna & peran (RBAC) |
| 2 | [`master_data`](#2-master_data) | Konfigurasi & referensi bisnis |
| 3 | [`transactions`](#3-transactions) | Log transaksi & pesanan |
| 4 | [`ai_analysis_results`](#4-ai_analysis_results) | Histori analisis AI Gemini |
| 5 | [`audit_logs`](#5-audit_logs) | Log audit aktivitas sistem |

---

## ERD (Entity Relationship)

```
users ──────────────────────────────────────────────────────┐
  │                                                          │
  ├──< master_data       (created_by → users.id)            │
  ├──< transactions      (user_id    → users.id)            │
  ├──< ai_analysis_results (user_id  → users.id)            │
  └──< audit_logs        (user_id    → users.id, nullable)  ┘
```

---

## 1. `users`

Menyimpan semua akun pengguna beserta peran dan status aktifnya. Mendukung autentikasi via email/password maupun Google OAuth.

| Kolom | Tipe | Null | Default | Keterangan |
|-------|------|------|---------|-----------|
| `id` | `INT UNSIGNED` | NO | `AUTO_INCREMENT` | Primary key |
| `name` | `VARCHAR(100)` | NO | — | Nama lengkap pengguna |
| `email` | `VARCHAR(255)` | NO | — | Email unik (UNIQUE) |
| `password_hash` | `VARCHAR(255)` | YES | `NULL` | bcrypt hash. `NULL` untuk akun Google OAuth |
| `role` | `ENUM('admin','mitra','pengunjung')` | NO | `'mitra'` | Peran RBAC |
| `is_active` | `BOOLEAN` | NO | `TRUE` | Status aktif akun |
| `token_version` | `INT UNSIGNED` | NO | `0` | Increment untuk invalidasi refresh token |
| `google_id` | `VARCHAR(255)` | YES | `NULL` | Subject ID dari Google OAuth 2.0 (UNIQUE) |
| `avatar_url` | `VARCHAR(500)` | YES | `NULL` | URL foto profil dari Google |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | Waktu dibuat |
| `updated_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP ON UPDATE` | Waktu diperbarui |

**Indexes & Constraints:**

| Nama | Tipe | Kolom |
|------|------|-------|
| `PRIMARY` | Primary Key | `id` |
| `uq_users_email` | Unique | `email` |
| `uq_users_google_id` | Unique | `google_id` |
| `idx_users_role` | Index | `role` |
| `idx_users_is_active` | Index | `is_active` |

**Catatan:**
- `password_hash` menggunakan bcrypt (rounds = 12)
- Jangan pernah mengembalikan kolom ini ke client
- Akun OAuth Google → `password_hash = NULL`, `google_id` terisi

---

## 2. `master_data`

Menyimpan konfigurasi dan data referensi bisnis yang dapat diubah tanpa deploy ulang (kategori produk, status, label, dll.).

| Kolom | Tipe | Null | Default | Keterangan |
|-------|------|------|---------|-----------|
| `id` | `INT UNSIGNED` | NO | `AUTO_INCREMENT` | Primary key |
| `category` | `VARCHAR(50)` | NO | — | Kelompok data, contoh: `KATEGORI_PRODUK` |
| `key` | `VARCHAR(100)` | NO | — | Kunci unik dalam kategori |
| `value` | `TEXT` | NO | — | Nilai konfigurasi |
| `description` | `VARCHAR(255)` | YES | `NULL` | Penjelasan penggunaan data |
| `created_by` | `INT UNSIGNED` | NO | — | FK → `users.id` (admin pembuat) |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | Waktu dibuat |
| `updated_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP ON UPDATE` | Waktu diperbarui |

**Indexes & Constraints:**

| Nama | Tipe | Kolom |
|------|------|-------|
| `PRIMARY` | Primary Key | `id` |
| `uq_master_data_category_key` | Unique | `(category, key)` |
| `idx_master_data_category` | Index | `category` |
| FK `created_by` | Foreign Key | `created_by → users.id` (RESTRICT on DELETE) |

**Contoh nilai `category`:**

| category | Deskripsi |
|----------|-----------|
| `KATEGORI_PRODUK` | Kategori produk keramik |
| `STATUS_TRANSAKSI` | Label status transaksi |

---

## 3. `transactions`

Mencatat setiap transaksi pembelian atau pesanan yang terjadi di platform.

| Kolom | Tipe | Null | Default | Keterangan |
|-------|------|------|---------|-----------|
| `id` | `INT UNSIGNED` | NO | `AUTO_INCREMENT` | Primary key |
| `user_id` | `INT UNSIGNED` | NO | — | FK → `users.id` (mitra/pembeli) |
| `transaction_type` | `VARCHAR(50)` | NO | — | Contoh: `PEMBELIAN`, `KONSINYASI`, `EKSPOR` |
| `amount` | `DECIMAL(15,2)` | NO | `0.00` | Nominal transaksi (Rupiah) |
| `status` | `ENUM('pending','success','failed','cancelled')` | NO | `'pending'` | Status transaksi |
| `reference_code` | `VARCHAR(50)` | NO | — | Kode unik (UNIQUE), contoh: `TRX-20261010-001` |
| `notes` | `TEXT` | YES | `NULL` | Catatan tambahan |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | Waktu dibuat |
| `updated_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP ON UPDATE` | Waktu diperbarui |

**Indexes & Constraints:**

| Nama | Tipe | Kolom |
|------|------|-------|
| `PRIMARY` | Primary Key | `id` |
| `uq_transactions_reference_code` | Unique | `reference_code` |
| `idx_transactions_user_id` | Index | `user_id` |
| `idx_transactions_status` | Index | `status` |
| `idx_transactions_created_at` | Index | `created_at` |
| FK `user_id` | Foreign Key | `user_id → users.id` (RESTRICT on DELETE) |

**Nilai `status`:**

| Status | Deskripsi |
|--------|-----------|
| `pending` | Menunggu konfirmasi/pembayaran |
| `success` | Transaksi berhasil |
| `failed` | Transaksi gagal |
| `cancelled` | Dibatalkan oleh user/sistem |

---

## 4. `ai_analysis_results`

Menyimpan histori permintaan dan hasil analisis dari Google Gemini AI.

| Kolom | Tipe | Null | Default | Keterangan |
|-------|------|------|---------|-----------|
| `id` | `INT UNSIGNED` | NO | `AUTO_INCREMENT` | Primary key |
| `user_id` | `INT UNSIGNED` | NO | — | FK → `users.id` |
| `prompt_context` | `TEXT` | NO | — | Input yang sudah dianonimisasi (JSON string) |
| `ai_response` | `JSON` | NO | — | Hasil analisis Gemini dalam format JSON |
| `model_used` | `VARCHAR(100)` | NO | — | Nama model Gemini yang digunakan |
| `tokens_used` | `INT UNSIGNED` | YES | `NULL` | Estimasi token yang dikonsumsi |
| `processing_time_ms` | `INT UNSIGNED` | YES | `NULL` | Waktu proses dalam milidetik |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | Waktu dibuat |

**Indexes & Constraints:**

| Nama | Tipe | Kolom |
|------|------|-------|
| `PRIMARY` | Primary Key | `id` |
| `idx_ai_results_user_id` | Index | `user_id` |
| `idx_ai_results_created_at` | Index | `created_at` |
| FK `user_id` | Foreign Key | `user_id → users.id` (CASCADE on DELETE) |

**Catatan:**
- `prompt_context` disimpan dalam bentuk JSON string yang sudah dianonimisasi (PII dihapus)
- Ketika user dihapus (`DELETE`), seluruh riwayat AI-nya ikut terhapus (`ON DELETE CASCADE`)

---

## 5. `audit_logs`

Mencatat semua aktivitas penting di sistem untuk keperluan keamanan, debugging, dan compliance.

| Kolom | Tipe | Null | Default | Keterangan |
|-------|------|------|---------|-----------|
| `id` | `BIGINT UNSIGNED` | NO | `AUTO_INCREMENT` | Primary key (BIGINT untuk volume tinggi) |
| `user_id` | `INT UNSIGNED` | YES | `NULL` | FK → `users.id`. `NULL` jika aksi dari tamu |
| `action` | `VARCHAR(255)` | NO | — | Deskripsi aksi, contoh: `[admin] POST /api/admin/users` |
| `table_name` | `VARCHAR(100)` | YES | `NULL` | Nama tabel yang terpengaruh |
| `record_id` | `INT UNSIGNED` | YES | `NULL` | ID record yang terpengaruh |
| `old_values` | `JSON` | YES | `NULL` | Nilai sebelum perubahan |
| `new_values` | `JSON` | YES | `NULL` | Nilai setelah perubahan |
| `ip_address` | `VARCHAR(45)` | YES | `NULL` | IP address (mendukung IPv6, maks 45 karakter) |
| `user_agent` | `VARCHAR(500)` | YES | `NULL` | Browser/client user agent |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | Waktu kejadian |

**Indexes & Constraints:**

| Nama | Tipe | Kolom |
|------|------|-------|
| `PRIMARY` | Primary Key | `id` |
| `idx_audit_logs_user_id` | Index | `user_id` |
| `idx_audit_logs_action` | Index | `action(100)` |
| `idx_audit_logs_created_at` | Index | `created_at` |
| FK `user_id` | Foreign Key | `user_id → users.id` (SET NULL on DELETE) |

**Catatan:**
- Menggunakan `BIGINT` karena volume log bisa sangat besar
- `user_id` di-set `NULL` jika user dihapus (bukan ikut terhapus), agar histori log tetap terjaga
- `old_values` / `new_values` berformat JSON untuk fleksibilitas logging berbagai tipe perubahan

---

## Relasi Antar Tabel

```
users (id)
  │
  ├─── master_data.created_by      ON DELETE RESTRICT  (admin wajib ada)
  ├─── transactions.user_id        ON DELETE RESTRICT  (transaksi tidak boleh orphan)
  ├─── ai_analysis_results.user_id ON DELETE CASCADE   (hapus user → hapus histori AI)
  └─── audit_logs.user_id          ON DELETE SET NULL  (hapus user → log tetap ada)
```

---

## Seed Data Default

### Admin

| Field | Value |
|-------|-------|
| `name` | `Super Admin` |
| `email` | `admin@dinoyocraft.com` |
| `password` | `Admin@DinoyoCraft123` *(ubah setelah deploy!)* |
| `role` | `admin` |

### Master Data

| category | key | value |
|----------|-----|-------|
| `KATEGORI_PRODUK` | `GERABAH_TRADISIONAL` | Gerabah Tradisional |
| `KATEGORI_PRODUK` | `KERAMIK_MODERN` | Keramik Modern |
| `KATEGORI_PRODUK` | `SOUVENIR_WISATA` | Souvenir Wisata |
| `STATUS_TRANSAKSI` | `PENDING` | Menunggu Konfirmasi |

---

## Migration History

| File | Deskripsi | Tanggal |
|------|-----------|---------|
| `schema.sql` | DDL awal — 5 tabel wajib + seed data | Initial |
| `migration_google_auth.sql` | Tambah kolom `google_id` & `avatar_url` ke `users`, ubah `password_hash` jadi nullable | v1.1 |

---

## Konvensi Penamaan

| Objek | Konvensi | Contoh |
|-------|----------|--------|
| Tabel | `snake_case`, plural | `audit_logs` |
| Kolom | `snake_case` | `created_at` |
| Primary Key | selalu `id` | `id` |
| Foreign Key | `{tabel_referensi}_id` | `user_id` |
| Unique Index | `uq_{tabel}_{kolom}` | `uq_users_email` |
| Index biasa | `idx_{tabel}_{kolom}` | `idx_users_role` |
| Enum | lowercase | `'pending'`, `'admin'` |
