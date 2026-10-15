import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import db from '../config/database';

export const registerMitra = async (req: Request, res: Response) => {
  // Ambil koneksi khusus untuk Transaction
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction(); // Mulai transaksi DB

    // 1. Ambil data teks dan file
    const { name, email, password, whatsapp_number, store_name, workshop_address, started_year } = req.body;

    // Memastikan TypeScript mengenali struktur files dari Multer
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // 2. Validasi kelengkapan teks
    if (!name || !email || !password || !whatsapp_number || !store_name || !workshop_address) {
      await connection.rollback();
      return res.status(400).json({ message: 'Semua data teks wajib diisi' });
    }

    // 3. Validasi kelengkapan file dokumen
    if (!files || !files.ktp_file || !files.nib_file || !files.product_images) {
      await connection.rollback();
      return res.status(400).json({ message: 'File KTP, NIB, dan Foto Produk wajib diunggah' });
    }

    // 4. Cek apakah email sudah dipakai
    const [existingUsers]: any = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(409).json({ message: 'Email sudah terdaftar' });
    }

    // 5. Hash Password
    const passwordHash = await bcrypt.hash(password, 10);

    // 6. SIMPAN KE TABEL `users`
    const [userResult]: any = await connection.query(
      'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
      [name, email, passwordHash, 'mitra', 1]
    );
    const newUserId = userResult.insertId; // Dapatkan ID user yang baru dibuat

    // 7. Siapkan path URL file
    // (Di production, ini bisa diganti dengan link Supabase/Cloud Storage)
    const ktpUrl = files.ktp_file[0].path;
    const nibUrl = files.nib_file[0].path;
    const productImagesUrls = files.product_images.map(file => file.path); // Array dari 3 path foto

    // 8. SIMPAN KE TABEL `mitra_profiles`
    await connection.query(
      `INSERT INTO mitra_profiles 
            (user_id, whatsapp_number, store_name, workshop_address, started_year, ktp_file_url, nib_file_url, sample_product_images, is_verified) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newUserId,
        whatsapp_number,
        store_name,
        workshop_address,
        started_year || null,
        ktpUrl,
        nibUrl,
        JSON.stringify(productImagesUrls), // Array diubah ke format JSON String
        0 // is_verified otomatis 0 (menunggu admin)
      ]
    );

    // 9. Jika semua berhasil, permanenkan data ke database
    await connection.commit();

    res.status(201).json({
      message: 'Registrasi Mitra berhasil! Menunggu verifikasi admin.',
      userId: newUserId
    });

  } catch (error) {
    // Jika ada error (termasuk saat upload atau insert), batalkan semua perubahan DB
    await connection.rollback();
    console.error('Error register mitra:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  } finally {
    // Kembalikan koneksi ke pool
    connection.release();
  }
};

export const loginMitra = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 1. Validasi input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email dan password wajib diisi' });
    }

    // 2. Cari user berdasarkan email, gabungkan (JOIN) dengan tabel mitra_profiles 
    // untuk mengambil nama toko dan status verifikasinya
    const query = `
            SELECT u.id, u.name, u.email, u.password_hash, u.role, u.is_active, 
                   m.store_name, m.is_verified 
            FROM users u 
            LEFT JOIN mitra_profiles m ON u.id = m.user_id 
            WHERE u.email = ?
        `;
    const [users]: any = await db.query(query, [email]);

    // Jika email tidak ditemukan di database
    if (users.length === 0) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    const user = users[0];

    // 3. Pastikan rolenya benar-benar 'mitra' (Keamanan tambahan)
    if (user.role !== 'mitra' && user.role !== 'admin') {
      return res.status(403).json({ message: 'Akses ditolak. Akun ini bukan akun Mitra.' });
    }

    // 4. Cek apakah akun aktif
    if (user.is_active === 0) {
      return res.status(403).json({ message: 'Akun Anda sedang dinonaktifkan.' });
    }

    // 5. Bandingkan password yang diketik dengan hash di database
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    // 6. Jika sukses, kembalikan data user
    // (Catatan: Di tahap produksi nanti, di sini Anda bisa menambahkan JWT Token)
    res.status(200).json({
      message: 'Login berhasil!',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        store_name: user.store_name, // Didapat dari relasi tabel mitra_profiles
        is_verified: user.is_verified
      }
    });

  } catch (error) {
    console.error('Error login mitra:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server saat login' });
  }
};