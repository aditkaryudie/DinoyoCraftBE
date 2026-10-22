import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import db from '../config/database';
import nodemailer from 'nodemailer';


export const registerMitra = async (req: Request, res: Response): Promise<void> => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { name, email, password, whatsapp_number, store_name, workshop_address, started_year } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!name || !email || !whatsapp_number || !store_name || !workshop_address) {
      await connection.rollback();
      res.status(400).json({ message: 'Semua data teks wajib diisi' });
      return;
    }

    if (!files || !files.ktp_file || !files.nib_file || !files.product_images) {
      await connection.rollback();
      res.status(400).json({ message: 'File KTP, NIB, dan Foto Produk wajib diunggah' });
      return;
    }

    const [existingUsers]: any = await connection.query('SELECT id, role FROM users WHERE email = ?', [email]);
    let newUserId: number;

    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      const [existingProfile]: any = await connection.query(
        'SELECT id, ktp_file_url FROM mitra_profiles WHERE user_id = ?',
        [existingUser.id]
      );
      if (existingProfile.length > 0 && existingProfile[0].ktp_file_url) {
        await connection.rollback();
        res.status(409).json({ message: 'Email sudah terdaftar sebagai Mitra' });
        return;
      }

      newUserId = existingUser.id;
      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        await connection.query('UPDATE users SET name = ?, password_hash = ? WHERE id = ?', [name, passwordHash, newUserId]);
      } else {
        await connection.query('UPDATE users SET name = ? WHERE id = ?', [name, newUserId]);
      }
    } else {
      const passwordHash = password ? await bcrypt.hash(password, 10) : null;
      const [userResult]: any = await connection.query(
        'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
        [name, email, passwordHash, 'mitra', 1]
      );
      newUserId = userResult.insertId;
    }

    const ktpUrl = `/uploads/${files.ktp_file[0].filename}`;
    const nibUrl = `/uploads/${files.nib_file[0].filename}`;
    const productImagesUrls = files.product_images.map(file => `/uploads/${file.filename}`);

    const [checkProfile]: any = await connection.query('SELECT id FROM mitra_profiles WHERE user_id = ?', [newUserId]);
    if (checkProfile.length > 0) {
      await connection.query(
        `UPDATE mitra_profiles SET 
         whatsapp_number = ?, store_name = ?, workshop_address = ?, started_year = ?, 
         ktp_file_url = ?, nib_file_url = ?, sample_product_images = ?, is_verified = 0, is_active = 1
         WHERE user_id = ?`,
        [
          whatsapp_number,
          store_name,
          workshop_address,
          started_year || null,
          ktpUrl,
          nibUrl,
          JSON.stringify(productImagesUrls),
          newUserId
        ]
      );
    } else {
      await connection.query(
        `INSERT INTO mitra_profiles 
         (user_id, whatsapp_number, store_name, workshop_address, started_year, ktp_file_url, nib_file_url, sample_product_images, is_verified, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
        [
          newUserId,
          whatsapp_number,
          store_name,
          workshop_address,
          started_year || null,
          ktpUrl,
          nibUrl,
          JSON.stringify(productImagesUrls)
        ]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Registrasi Mitra berhasil! Menunggu verifikasi admin.',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
    return;

  } catch (error) {
    await connection.rollback();
    console.error('Error register mitra:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server',
      meta: { timestamp: new Date().toISOString() }
    });
    return;
  } finally {
    connection.release();
  }
};

export const loginMitra = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email dan password wajib diisi',
        meta: { timestamp: new Date().toISOString() }
      });
      return;
    }

    const query = `
      SELECT u.id, u.name, u.email, u.password_hash, u.role, u.is_active, 
             m.store_name, m.is_verified 
      FROM users u 
      LEFT JOIN mitra_profiles m ON u.id = m.user_id 
      WHERE u.email = ?
    `;
    const [users]: any = await db.query(query, [email]);

    if (users.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Email atau password salah',
        meta: { timestamp: new Date().toISOString() }
      });
      return;
    }

    const user = users[0];

    if (user.role !== 'mitra' && user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Akses ditolak. Akun ini bukan akun Mitra.',
        meta: { timestamp: new Date().toISOString() }
      });
      return;
    }

    if (user.is_active === 0) {
      res.status(403).json({
        success: false,
        message: 'Akun Anda sedang dinonaktifkan.',
        meta: { timestamp: new Date().toISOString() }
      });
      return;
    }

    // ============================================================
    // 🔒 PROTEKSI VERIFIKASI MITRA (TAMBAHAN LOGIK)
    // ============================================================
    if (user.role === 'mitra' && (!user.is_verified || user.is_verified === 0)) {
      res.status(403).json({
        success: false,
        message: 'Akun Toko Anda belum disetujui oleh Admin atau pengajuan ditolak.',
        meta: { timestamp: new Date().toISOString() }
      });
      return;
    }

    if (!user.password_hash) {
      res.status(400).json({
        success: false,
        message: 'Akun ini terdaftar melalui Google. Silakan masuk menggunakan Google.',
        meta: { timestamp: new Date().toISOString() }
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: "Email atau password salah!",
        meta: { timestamp: new Date().toISOString() }
      });
      return;
    }

    const jwtSecret = process.env['JWT_SECRET'] || 'your_super_secret_jwt_key_min_32_chars';
    const jwtExpiresIn = process.env['JWT_EXPIRES_IN'] || '7d';
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: jwtExpiresIn as any }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Ubah dari 'strict' menjadi 'lax'
      maxAge: 24 * 60 * 60 * 1000 // 1 hari
    });

    res.status(200).json({
      success: true,
      message: "Login berhasil!",
      data: {
        token: token,
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        store_name: user.store_name,
        is_verified: user.is_verified
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
    return;

  } catch (error) {
    console.error('Error login mitra:', error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server.",
      meta: { timestamp: new Date().toISOString() }
    });
    return;
  }
};

export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential, userInfo } = req.body;

    if (!credential && !userInfo) {
      res.status(400).json({ message: 'Data otentikasi Google wajib dikirim' });
      return;
    }

    let email = '';
    let name = '';
    let googleId = '';
    let avatarUrl: string | null = null;

    if (credential) {
      try {
        const client = new OAuth2Client(process.env['GOOGLE_CLIENT_ID']);
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: process.env['GOOGLE_CLIENT_ID'],
        });
        const payload = ticket.getPayload();
        if (payload && payload.email) {
          email = payload.email;
          name = payload.name || payload.given_name || 'Pengguna Google';
          googleId = payload.sub;
          avatarUrl = payload.picture || null;
        }
      } catch (verifyError) {
        console.warn('Google verifyIdToken failed, attempting JWT decode fallback:', verifyError);
        try {
          const parts = credential.split('.');
          if (parts.length === 3) {
            const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            if (decoded && decoded.email) {
              email = decoded.email;
              name = decoded.name || decoded.given_name || 'Pengguna Google';
              googleId = decoded.sub || '';
              avatarUrl = decoded.picture || null;
            }
          }
        } catch (decodeErr) {
          console.error('Failed to decode Google token:', decodeErr);
        }
      }
    } else if (userInfo && userInfo.email) {
      email = userInfo.email;
      name = userInfo.name || 'Pengguna Google';
      googleId = userInfo.sub || userInfo.id || '';
      avatarUrl = userInfo.picture || null;
    }

    if (!email) {
      res.status(400).json({ message: 'Gagal mendapatkan data akun dari Google' });
      return;
    }

    const query = `
      SELECT u.id, u.name, u.email, u.role, u.is_active, u.google_id, u.avatar_url,
             m.store_name, m.is_verified 
      FROM users u 
      LEFT JOIN mitra_profiles m ON u.id = m.user_id 
      WHERE (u.google_id IS NOT NULL AND u.google_id = ?) OR u.email = ?
      LIMIT 1
    `;
    const [users]: any = await db.query(query, [googleId || 'NON_EXISTENT_ID', email]);

    let user;

    if (users.length > 0) {
      user = users[0];

      if (user.is_active === 0) {
        res.status(403).json({ message: 'Akun Anda sedang dinonaktifkan.' });
        return;
      }

      if (user.role !== 'mitra' && user.role !== 'admin') {
        res.status(403).json({ message: 'Akses ditolak. Akun ini bukan akun Mitra atau Admin.' });
        return;
      }

      if (!user.google_id || !user.avatar_url) {
        await db.query(
          'UPDATE users SET google_id = COALESCE(google_id, ?), avatar_url = COALESCE(avatar_url, ?) WHERE id = ?',
          [googleId || null, avatarUrl || null, user.id]
        );
      }
    } else {
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        const [insertUser]: any = await connection.query(
          'INSERT INTO users (name, email, password_hash, role, is_active, google_id, avatar_url) VALUES (?, ?, NULL, ?, 1, ?, ?)',
          [name, email, 'mitra', googleId || null, avatarUrl || null]
        );
        const newUserId = insertUser.insertId;

        await connection.query(
          `INSERT INTO mitra_profiles 
           (user_id, whatsapp_number, store_name, workshop_address, started_year, ktp_file_url, nib_file_url, sample_product_images, is_verified, is_active) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
          [
            newUserId,
            '-',
            'Toko ' + name,
            '-',
            new Date().getFullYear(),
            '',
            '',
            '[]'
          ]
        );

        await connection.commit();

        user = {
          id: newUserId,
          name,
          email,
          role: 'mitra',
          store_name: 'Toko ' + name,
          is_verified: 0,
          avatar_url: avatarUrl
        };
      } catch (insertErr) {
        await connection.rollback();
        throw insertErr;
      } finally {
        connection.release();
      }
    }

    // ============================================================
    // 🔒 PROTEKSI VERIFIKASI MITRA UNTUK GOOGLE LOGIN
    // ============================================================
    if (user.role === 'mitra' && (!user.is_verified || user.is_verified === 0)) {
      res.status(403).json({
        message: 'Akun Toko Anda belum disetujui oleh Admin atau pengajuan ditolak.'
      });
      return;
    }

    const jwtSecret = process.env['JWT_SECRET'] || 'your_super_secret_jwt_key_min_32_chars';
    const jwtExpiresIn = process.env['JWT_EXPIRES_IN'] || '7d';
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: jwtExpiresIn as any }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      success: true,
      message: 'Login dengan Google berhasil!',
      token,
      data: {
        token,
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        store_name: user.store_name,
        is_verified: user.is_verified,
        avatar_url: user.avatar_url || avatarUrl
      }
    });
    return;

  } catch (error) {
    console.error('Error google login:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server saat login dengan Google' });
    return;
  }
};

export const getProfile = async (_req: Request, res: Response) => {
  try {
    const userId = res.locals['userId'];
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const [rows]: any = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.avatar_url,
              m.store_name, m.whatsapp_number, m.workshop_address, 
              m.started_year, m.description, m.website, m.instagram, 
              m.banner_url, m.is_verified
       FROM users u
       LEFT JOIN mitra_profiles m ON u.id = m.user_id
       WHERE u.id = ?`,
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error getProfile:', error);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = res.locals['userId'];
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const ownerName = req.body.ownerName ?? req.body.nama;
    const storeName = req.body.storeName ?? req.body.nama_toko;
    const phone = req.body.phone ?? req.body.whatsapp_number;
    const address = req.body.address ?? req.body.alamat ?? req.body.workshop_address;
    const yearStarted = req.body.yearStarted ?? req.body.tahun_mulai ?? req.body.started_year;
    const description = req.body.description ?? req.body.deskripsi;
    const website = req.body.website;
    const instagram = req.body.instagram;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    const avatarPath = files?.['avatar']?.[0] ? `/uploads/${files['avatar'][0].filename}` : null;
    const bannerPath = files?.['banner']?.[0] ? `/uploads/${files['banner'][0].filename}` : null;

    // Update nama & avatar_url di tabel users
    await db.query(
      `UPDATE users 
       SET name = COALESCE(?, name), 
           avatar_url = COALESCE(?, avatar_url) 
       WHERE id = ?`,
      [ownerName ?? null, avatarPath, userId]
    );

    // Periksa apakah profil mitra sudah ada di tabel mitra_profiles
    const [checkProfile]: any = await db.query('SELECT id FROM mitra_profiles WHERE user_id = ?', [userId]);

    if (checkProfile && checkProfile.length > 0) {
      // Update profil mitra di tabel mitra_profiles
      await db.query(
        `UPDATE mitra_profiles 
         SET store_name = COALESCE(?, store_name), 
             whatsapp_number = COALESCE(?, whatsapp_number), 
             workshop_address = COALESCE(?, workshop_address), 
             started_year = COALESCE(?, started_year),
             description = COALESCE(?, description), 
             website = COALESCE(?, website), 
             instagram = COALESCE(?, instagram),
             banner_url = COALESCE(?, banner_url)
         WHERE user_id = ?`,
        [
          storeName ?? null,
          phone ?? null,
          address ?? null,
          yearStarted ? parseInt(String(yearStarted), 10) : null,
          description ?? null,
          website ?? null,
          instagram ?? null,
          bannerPath,
          userId
        ]
      );
    } else {
      // Buat baru jika belum ada
      await db.query(
        `INSERT INTO mitra_profiles 
         (user_id, store_name, whatsapp_number, workshop_address, started_year, description, website, instagram, banner_url, is_verified, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
        [
          userId,
          storeName ?? null,
          phone ?? null,
          address ?? null,
          yearStarted ? parseInt(String(yearStarted), 10) : null,
          description ?? null,
          website ?? null,
          instagram ?? null,
          bannerPath
        ]
      );
    }

    // Ambil data profil terbaru
    const [rows]: any = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.avatar_url,
              m.store_name, m.whatsapp_number, m.workshop_address, 
              m.started_year, m.description, m.website, m.instagram, 
              m.banner_url, m.is_verified
       FROM users u
       LEFT JOIN mitra_profiles m ON u.id = m.user_id
       WHERE u.id = ?`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Profil berhasil diperbarui',
      data: rows && rows.length > 0 ? rows[0] : null
    });
  } catch (error) {
    console.error('Error updateProfile:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui profil' });
  }
};

// ============================================================
// 🔑 OTP Store (In-Memory) — Simpan OTP sementara
// ============================================================
interface OtpEntry {
  code: string;
  email: string;
  expiresAt: number;
  verified: boolean;
}

const otpStore = new Map<string, OtpEntry>();

// Bersihkan OTP expired setiap 10 menit
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of otpStore.entries()) {
    if (now > entry.expiresAt) {
      otpStore.delete(key);
    }
  }
}, 10 * 60 * 1000);



// Konfigurasi Email Pengirim
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env['EMAIL_USER'],
    pass: process.env['EMAIL_PASS'], // Pastikan pakai 16-digit App Password dari Google
  },
});

// ============================================================
// FORGOT PASSWORD — Kirim OTP ke email user
// ============================================================
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  console.log("=== API FORGOT PASSWORD DI-HIT ===", req.body);
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ success: false, message: 'Email wajib diisi' });
      return;
    }

    // 1. Cek apakah user ada di database
    const [users]: any = await db.query('SELECT id, name, email FROM users WHERE email = ?', [email]);
    if (!users || users.length === 0) {
      res.status(404).json({ success: false, message: 'Akun dengan email tersebut tidak ditemukan.' });
      return;
    }

    const user = users[0];

    // 2. Buat Kode OTP 6 Digit Angka
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Simpan OTP ke memory (otpStore) agar bisa dicek oleh fungsi resetPassword nanti
    const expiresAt = Date.now() + 5 * 60 * 1000; // Kadaluarsa dalam 5 menit
    otpStore.set(email.toLowerCase(), { code: otp, email: email.toLowerCase(), verified: false, expiresAt });

    // 4. Print ke terminal (Biar kamu tidak perlu nunggu email masuk saat testing!)
    console.log(`\n========================================`);
    console.log(`[DEV OTP] Kode OTP untuk ${email}: ${otp}`);
    console.log(`========================================\n`);

    // 5. Kirim OTP via Email
    const mailOptions = {
      from: `"DinoyoCraft Portal" <${process.env['EMAIL_USER']}>`,
      to: email,
      subject: 'Kode OTP Verifikasi Lupa Kata Sandi - DinoyoCraft',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9; border-radius: 10px;">
          <h2 style="color: #333;">Permintaan Reset Kata Sandi</h2>
          <p>Halo ${user.name},</p>
          <p>Kami menerima permintaan untuk mereset kata sandi akun DinoyoCraft Anda. Berikut adalah kode OTP Anda:</p>
          <h1 style="background-color: #e5e7eb; padding: 10px; text-align: center; letter-spacing: 5px; font-size: 32px; color: #1f2937; border-radius: 8px;">${otp}</h1>
          <p style="color: #ef4444; font-size: 14px;">Kode ini hanya berlaku selama 5 menit.</p>
          <p>Jika Anda tidak meminta reset kata sandi, abaikan email ini.</p>
        </div>
      `,
    };

    // Kirim jika konfigurasi email terisi
    if (process.env['EMAIL_USER'] && process.env['EMAIL_PASS'] && process.env['EMAIL_PASS'] !== 'xxxx xxxx xxxx xxxx') {
      try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ [OTP] Email OTP berhasil dikirim ke ${email}`);
      } catch (mailError) {
        console.error('⚠️ [OTP] Gagal mengirim email via Nodemailer:', mailError);
      }
    } else {
      console.log('⚠️ [OTP] EMAIL_USER/EMAIL_PASS belum dikonfigurasi. Gunakan kode OTP dari log terminal di atas.');
    }

    res.status(200).json({
      success: true,
      message: `Instruksi reset kata sandi telah dikirimkan ke ${email}`,
    });
    return;
  } catch (error: any) {
    console.error('Error forgot password:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat mengirim email' });
    return;
  }
};

// ============================================================
// VERIFY OTP — Validasi kode OTP yang dimasukkan user
// ============================================================
export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({ success: false, message: 'Email dan kode OTP wajib diisi' });
      return;
    }

    const entry = otpStore.get(email.toLowerCase());

    if (!entry) {
      res.status(400).json({
        success: false,
        message: 'Kode OTP tidak ditemukan. Silakan minta kode OTP baru.',
      });
      return;
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(email.toLowerCase());
      res.status(400).json({
        success: false,
        message: 'Kode OTP telah kedaluwarsa. Silakan minta kode OTP baru.',
      });
      return;
    }

    if (entry.code !== otp) {
      res.status(400).json({
        success: false,
        message: 'Kode OTP salah. Periksa kembali kode yang Anda masukkan.',
      });
      return;
    }

    // Tandai OTP sebagai verified
    entry.verified = true;
    otpStore.set(email.toLowerCase(), entry);

    res.status(200).json({
      success: true,
      message: 'Kode OTP berhasil diverifikasi!',
    });
    return;
  } catch (error: any) {
    console.error('Error verify OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server',
    });
    return;
  }
};

// ============================================================
// RESET PASSWORD — Ubah kata sandi setelah OTP terverifikasi
// ============================================================
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, newPassword, otp } = req.body;

    if (!email || !newPassword) {
      res.status(400).json({ success: false, message: 'Email dan kata sandi baru wajib diisi' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'Kata sandi minimal 8 karakter' });
      return;
    }

    // Cek OTP terverifikasi atau kode OTP cocok
    const entry = otpStore.get(email.toLowerCase());
    const isOtpValid = entry && (entry.verified || (otp && entry.code === otp));

    if (!entry || !isOtpValid) {
      res.status(400).json({
        success: false,
        message: 'OTP belum diverifikasi atau tidak valid. Silakan verifikasi OTP terlebih dahulu.',
      });
      return;
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(email.toLowerCase());
      res.status(400).json({
        success: false,
        message: 'Sesi reset telah kedaluwarsa. Silakan ulangi proses dari awal.',
      });
      return;
    }

    const [users]: any = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (!users || users.length === 0) {
      res.status(404).json({ success: false, message: 'Akun dengan email tersebut tidak ditemukan' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = ? WHERE email = ?', [passwordHash, email]);

    // Hapus OTP dari store setelah berhasil reset
    otpStore.delete(email.toLowerCase());

    res.status(200).json({
      success: true,
      message: 'Kata sandi berhasil diperbarui',
    });
    return;
  } catch (error: any) {
    console.error('Error reset password:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server',
    });
    return;
  }
};

