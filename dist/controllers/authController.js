"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resendRegisterOtp = exports.verifyRegisterOtp = exports.checkUsername = exports.reuploadDocs = exports.resetPassword = exports.verifyOtp = exports.forgotPassword = exports.updateProfile = exports.getProfile = exports.googleLogin = exports.loginMitra = exports.registerMitra = exports.saveFcmToken = exports.registerCustomer = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const google_auth_library_1 = require("google-auth-library");
const database_1 = __importDefault(require("../config/database"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const registerCustomer = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        if (!name || !email || !password) {
            res.status(400).json({
                success: false,
                message: 'Nama, email, dan password wajib diisi',
                meta: { timestamp: new Date().toISOString() }
            });
            return;
        }
        if (password.length < 6) {
            res.status(400).json({
                success: false,
                message: 'Password minimal 6 karakter',
                meta: { timestamp: new Date().toISOString() }
            });
            return;
        }
        const [existingUsers] = await database_1.default.query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
        if (existingUsers && existingUsers.length > 0) {
            res.status(409).json({
                success: false,
                message: 'Email sudah terdaftar. Silakan login atau gunakan email lain.',
                meta: { timestamp: new Date().toISOString() }
            });
            return;
        }
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const [result] = await database_1.default.query('INSERT INTO users (name, email, password_hash, role, is_active, phone) VALUES (?, ?, ?, "pengunjung", 1, ?)', [name.trim(), email.trim().toLowerCase(), passwordHash, phone ? phone.trim() : null]);
        const newUserId = result.insertId;
        if (phone && phone.trim()) {
            await database_1.default.query('INSERT INTO user_addresses (user_id, recipient_name, phone, full_address, is_default) VALUES (?, ?, ?, ?, 1)', [newUserId, name.trim(), phone.trim(), 'Belum ada alamat lengkap']).catch(() => { });
        }
        const jwtSecret = process.env['JWT_SECRET'] || 'your_super_secret_jwt_key_min_32_chars';
        const jwtExpiresIn = process.env['JWT_EXPIRES_IN'] || '7d';
        const token = jsonwebtoken_1.default.sign({ userId: newUserId, email: email.trim().toLowerCase(), role: 'pengunjung' }, jwtSecret, { expiresIn: jwtExpiresIn });
        res.status(201).json({
            success: true,
            message: 'Pendaftaran pengunjung berhasil!',
            token,
            data: {
                token,
                id: newUserId,
                name: name.trim(),
                email: email.trim().toLowerCase(),
                phone: phone ? phone.trim() : null,
                role: 'pengunjung',
            },
            meta: { timestamp: new Date().toISOString() }
        });
    }
    catch (error) {
        console.error('Error register customer:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server saat pendaftaran.',
            meta: { timestamp: new Date().toISOString() }
        });
    }
};
exports.registerCustomer = registerCustomer;
const saveFcmToken = async (req, res) => {
    try {
        const userId = res.locals['userId'];
        const { fcm_token, platform = 'android' } = req.body;
        if (!fcm_token) {
            res.status(400).json({ success: false, message: 'FCM Token wajib dikirim' });
            return;
        }
        await database_1.default.query(`INSERT INTO user_device_tokens (user_id, fcm_token, platform)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE platform = VALUES(platform), updated_at = NOW()`, [userId, fcm_token, platform]);
        res.status(200).json({ success: true, message: 'FCM token berhasil disinkronkan' });
    }
    catch (error) {
        console.error('Error save FCM token:', error);
        res.status(500).json({ success: false, message: 'Gagal menyimpan FCM token' });
    }
};
exports.saveFcmToken = saveFcmToken;
const registerMitra = async (req, res) => {
    const connection = await database_1.default.getConnection();
    try {
        await connection.beginTransaction();
        const { name, email, password, whatsapp_number, store_name, workshop_address, started_year } = req.body;
        const files = req.files;
        if (!name || !email || !whatsapp_number || !store_name || !workshop_address) {
            await connection.rollback();
            res.status(400).json({ message: 'Semua data teks wajib diisi' });
            return;
        }
        const nameRegex = /^[a-zA-Z\s]+$/;
        if (!nameRegex.test(name.trim())) {
            await connection.rollback();
            res.status(400).json({ message: 'Format nama tidak valid (hanya huruf dan spasi)' });
            return;
        }
        const phoneRegex = /^[0-9]+$/;
        if (!phoneRegex.test(whatsapp_number.trim())) {
            await connection.rollback();
            res.status(400).json({ message: 'Nomor HP hanya boleh berisi angka' });
            return;
        }
        if (whatsapp_number.trim().length < 10 || whatsapp_number.trim().length > 14) {
            await connection.rollback();
            res.status(400).json({ message: 'Nomor HP harus 10-14 digit' });
            return;
        }
        if (!files || !files.ktp_file || !files.nib_file || !files.product_images) {
            await connection.rollback();
            res.status(400).json({ message: 'File KTP, NIB, dan Foto Produk wajib diunggah' });
            return;
        }
        const [existingUsers] = await connection.query('SELECT id, role FROM users WHERE email = ?', [email]);
        let newUserId;
        if (existingUsers.length > 0) {
            const existingUser = existingUsers[0];
            const [existingProfile] = await connection.query('SELECT id, ktp_file_url FROM mitra_profiles WHERE user_id = ?', [existingUser.id]);
            if (existingProfile.length > 0 && existingProfile[0].ktp_file_url) {
                await connection.rollback();
                res.status(409).json({ message: 'Email sudah terdaftar sebagai Mitra' });
                return;
            }
            newUserId = existingUser.id;
            if (password) {
                const passwordHash = await bcrypt_1.default.hash(password, 10);
                await connection.query('UPDATE users SET name = ?, password_hash = ? WHERE id = ?', [name, passwordHash, newUserId]);
            }
            else {
                await connection.query('UPDATE users SET name = ? WHERE id = ?', [name, newUserId]);
            }
        }
        else {
            const passwordHash = password ? await bcrypt_1.default.hash(password, 10) : null;
            const [userResult] = await connection.query('INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)', [name, email, passwordHash, 'mitra', 1]);
            newUserId = userResult.insertId;
        }
        const ktpUrl = `/uploads/${files.ktp_file[0].filename}`;
        const nibUrl = `/uploads/${files.nib_file[0].filename}`;
        const productImagesUrls = files.product_images.map(file => `/uploads/${file.filename}`);
        const [checkProfile] = await connection.query('SELECT id FROM mitra_profiles WHERE user_id = ?', [newUserId]);
        if (checkProfile.length > 0) {
            await connection.query(`UPDATE mitra_profiles SET 
         whatsapp_number = ?, store_name = ?, workshop_address = ?, started_year = ?, 
         ktp_file_url = ?, nib_file_url = ?, sample_product_images = ?, is_verified = 0, rejection_reason = NULL, is_active = 1
         WHERE user_id = ?`, [
                whatsapp_number,
                store_name,
                workshop_address,
                started_year || null,
                ktpUrl,
                nibUrl,
                JSON.stringify(productImagesUrls),
                newUserId
            ]);
        }
        else {
            await connection.query(`INSERT INTO mitra_profiles 
         (user_id, whatsapp_number, store_name, workshop_address, started_year, ktp_file_url, nib_file_url, sample_product_images, is_verified, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`, [
                newUserId,
                whatsapp_number,
                store_name,
                workshop_address,
                started_year || null,
                ktpUrl,
                nibUrl,
                JSON.stringify(productImagesUrls)
            ]);
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
    }
    catch (error) {
        await connection.rollback();
        console.error('Error register mitra:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server',
            meta: { timestamp: new Date().toISOString() }
        });
        return;
    }
    finally {
        connection.release();
    }
};
exports.registerMitra = registerMitra;
const loginMitra = async (req, res) => {
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
             COALESCE(u.avatar_url, m.avatar_url) AS avatar_url,
             COALESCE(u.phone, m.whatsapp_number) AS phone,
             u.birth_date, u.gender,
             m.store_name, m.is_verified, m.rejection_reason FROM users u 
      LEFT JOIN mitra_profiles m ON u.id = m.user_id 
      WHERE u.email = ?
    `;
        const [users] = await database_1.default.query(query, [email]);
        if (users.length === 0) {
            res.status(401).json({
                success: false,
                message: 'Email atau password salah',
                meta: { timestamp: new Date().toISOString() }
            });
            return;
        }
        const user = users[0];
        if (req.path === '/login-mitra' && user.role !== 'mitra' && user.role !== 'admin') {
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
        // Mitra belum terverifikasi / ditolak tetap diizinkan login
        if (!user.password_hash) {
            res.status(400).json({
                success: false,
                message: 'Akun ini terdaftar melalui Google. Silakan masuk menggunakan Google.',
                meta: { timestamp: new Date().toISOString() }
            });
            return;
        }
        const isMatch = await bcrypt_1.default.compare(password, user.password_hash);
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
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: jwtExpiresIn });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax', // Ubah dari 'strict' menjadi 'lax'
            maxAge: 24 * 60 * 60 * 1000 // 1 hari
        });
        res.status(200).json({
            success: true,
            message: "Login berhasil!",
            token: token,
            data: {
                token: token,
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar_url: user.avatar_url,
                phone: user.phone,
                birth_date: user.birth_date,
                gender: user.gender,
                store_name: user.store_name,
                is_verified: user.is_verified,
                rejection_reason: user.rejection_reason
            },
            meta: {
                timestamp: new Date().toISOString()
            }
        });
        return;
    }
    catch (error) {
        console.error('Error login mitra:', error);
        res.status(500).json({
            success: false,
            message: "Terjadi kesalahan pada server.",
            meta: { timestamp: new Date().toISOString() }
        });
        return;
    }
};
exports.loginMitra = loginMitra;
const googleLogin = async (req, res) => {
    try {
        const { credential, userInfo } = req.body;
        if (!credential && !userInfo) {
            res.status(400).json({ message: 'Data otentikasi Google wajib dikirim' });
            return;
        }
        let email = '';
        let name = '';
        let googleId = '';
        let avatarUrl = null;
        if (credential) {
            try {
                const client = new google_auth_library_1.OAuth2Client(process.env['GOOGLE_CLIENT_ID']);
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
            }
            catch (verifyError) {
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
                }
                catch (decodeErr) {
                    console.error('Failed to decode Google token:', decodeErr);
                }
            }
        }
        else if (userInfo && userInfo.email) {
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
             m.store_name, m.is_verified, m.rejection_reason FROM users u 
      LEFT JOIN mitra_profiles m ON u.id = m.user_id 
      WHERE (u.google_id IS NOT NULL AND u.google_id = ?) OR u.email = ?
      LIMIT 1
    `;
        const [users] = await database_1.default.query(query, [googleId || 'NON_EXISTENT_ID', email]);
        let user;
        if (users.length > 0) {
            user = users[0];
            if (user.is_active === 0) {
                res.status(403).json({ message: 'Akun Anda sedang dinonaktifkan.' });
                return;
            }
            if (user.role !== 'mitra' && user.role !== 'admin' && user.role !== 'pengunjung') {
                res.status(403).json({ message: 'Akses ditolak. Peran pengguna tidak diizinkan.' });
                return;
            }
            if (!user.google_id || !user.avatar_url) {
                await database_1.default.query('UPDATE users SET google_id = COALESCE(google_id, ?), avatar_url = COALESCE(avatar_url, ?) WHERE id = ?', [googleId || null, avatarUrl || null, user.id]);
            }
        }
        else {
            const connection = await database_1.default.getConnection();
            try {
                await connection.beginTransaction();
                const targetRole = (req.body.role === 'pengunjung') ? 'pengunjung' : 'mitra';
                const [insertUser] = await connection.query('INSERT INTO users (name, email, password_hash, role, is_active, google_id, avatar_url) VALUES (?, ?, NULL, ?, 1, ?, ?)', [name, email, targetRole, googleId || null, avatarUrl || null]);
                const newUserId = insertUser.insertId;
                if (targetRole === 'mitra') {
                    await connection.query(`INSERT INTO mitra_profiles 
             (user_id, whatsapp_number, store_name, workshop_address, started_year, ktp_file_url, nib_file_url, sample_product_images, is_verified, is_active) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`, [
                        newUserId,
                        '-',
                        'Toko ' + name,
                        '-',
                        new Date().getFullYear(),
                        '',
                        '',
                        '[]'
                    ]);
                }
                await connection.commit();
                user = {
                    id: newUserId,
                    name,
                    email,
                    role: targetRole,
                    store_name: targetRole === 'mitra' ? ('Toko ' + name) : undefined,
                    is_verified: targetRole === 'mitra' ? 0 : 1,
                    avatar_url: avatarUrl
                };
            }
            catch (insertErr) {
                await connection.rollback();
                throw insertErr;
            }
            finally {
                connection.release();
            }
        }
        // Mitra belum terverifikasi / ditolak Google login diizinkan
        const jwtSecret = process.env['JWT_SECRET'] || 'your_super_secret_jwt_key_min_32_chars';
        const jwtExpiresIn = process.env['JWT_EXPIRES_IN'] || '7d';
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: jwtExpiresIn });
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
                rejection_reason: user.rejection_reason,
                avatar_url: user.avatar_url || avatarUrl
            }
        });
        return;
    }
    catch (error) {
        console.error('Error google login:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server saat login dengan Google' });
        return;
    }
};
exports.googleLogin = googleLogin;
const getProfile = async (_req, res) => {
    try {
        const userId = res.locals['userId'];
        if (!userId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const [rows] = await database_1.default.query(`SELECT u.id, u.name, u.email, u.role, COALESCE(u.avatar_url, m.avatar_url) AS avatar_url,
              COALESCE(u.phone, m.whatsapp_number) AS phone,
              u.birth_date, u.birth_date AS birthDate, u.gender,
              m.store_name, m.whatsapp_number, m.workshop_address, 
              m.started_year, m.description, m.website, m.instagram, 
              m.banner_url, m.is_verified, m.rejection_reason, m.ktp_file_url, m.nib_file_url, m.sample_product_images FROM users u
       LEFT JOIN mitra_profiles m ON u.id = m.user_id
       WHERE u.id = ?`, [userId]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
        }
        return res.status(200).json({ success: true, data: rows[0] });
    }
    catch (error) {
        console.error('Error getProfile:', error);
        return res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
    }
};
exports.getProfile = getProfile;
const updateProfile = async (req, res) => {
    try {
        const userId = res.locals['userId'];
        if (!userId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const ownerName = req.body.ownerName ?? req.body.nama ?? req.body.name;
        const storeName = req.body.storeName ?? req.body.nama_toko;
        const phone = req.body.phone ?? req.body.whatsapp_number;
        const birthDate = req.body.birthDate ?? req.body.birth_date;
        const gender = req.body.gender;
        const address = req.body.address ?? req.body.alamat ?? req.body.workshop_address;
        const yearStarted = req.body.yearStarted ?? req.body.tahun_mulai ?? req.body.started_year;
        const description = req.body.description ?? req.body.deskripsi;
        const website = req.body.website;
        const instagram = req.body.instagram;
        const files = req.files;
        const avatarPath = files?.['avatar']?.[0] ? `/uploads/${files['avatar'][0].filename}` : null;
        const bannerPath = files?.['banner']?.[0] ? `/uploads/${files['banner'][0].filename}` : null;
        // Update nama, avatar_url, phone, birth_date, dan gender di tabel users
        await database_1.default.query(`UPDATE users 
       SET name = COALESCE(?, name), 
           avatar_url = COALESCE(?, avatar_url),
           phone = COALESCE(?, phone),
           birth_date = COALESCE(?, birth_date),
           gender = COALESCE(?, gender)
       WHERE id = ?`, [ownerName ?? null, avatarPath, phone ?? null, birthDate ?? null, gender ?? null, userId]);
        // Periksa apakah profil mitra sudah ada di tabel mitra_profiles
        const [checkProfile] = await database_1.default.query('SELECT id FROM mitra_profiles WHERE user_id = ?', [userId]);
        if (checkProfile && checkProfile.length > 0) {
            // Update profil mitra di tabel mitra_profiles
            await database_1.default.query(`UPDATE mitra_profiles 
         SET store_name = COALESCE(?, store_name), 
             whatsapp_number = COALESCE(?, whatsapp_number), 
             workshop_address = COALESCE(?, workshop_address), 
             started_year = COALESCE(?, started_year),
             description = COALESCE(?, description), 
             website = COALESCE(?, website), 
             instagram = COALESCE(?, instagram),
             banner_url = COALESCE(?, banner_url),
             avatar_url = COALESCE(?, avatar_url)
         WHERE user_id = ?`, [
                storeName ?? null,
                phone ?? null,
                address ?? null,
                yearStarted ? parseInt(String(yearStarted), 10) : null,
                description ?? null,
                website ?? null,
                instagram ?? null,
                bannerPath,
                avatarPath,
                userId
            ]);
        }
        else if (res.locals['role'] === 'mitra' ||
            storeName ||
            address ||
            description ||
            website ||
            instagram ||
            bannerPath) {
            // Buat baru jika belum ada (dengan fallback aman untuk kolom NOT NULL)
            await database_1.default.query(`INSERT INTO mitra_profiles 
         (user_id, store_name, whatsapp_number, workshop_address, started_year, description, website, instagram, banner_url, avatar_url, ktp_file_url, nib_file_url, sample_product_images, is_verified, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', '[]', 1, 1)`, [
                userId,
                storeName ?? 'Toko Mitra',
                phone ?? '-',
                address ?? '-',
                yearStarted ? parseInt(String(yearStarted), 10) : null,
                description ?? null,
                website ?? null,
                instagram ?? null,
                bannerPath,
                avatarPath
            ]);
        }
        // Ambil data profil terbaru
        const [rows] = await database_1.default.query(`SELECT u.id, u.name, u.email, u.role, COALESCE(u.avatar_url, m.avatar_url) AS avatar_url,
              COALESCE(u.phone, m.whatsapp_number) AS phone,
              u.birth_date, u.birth_date AS birthDate, u.gender,
              m.store_name, m.whatsapp_number, m.workshop_address, 
              m.started_year, m.description, m.website, m.instagram, 
              m.banner_url, m.is_verified, m.rejection_reason,
              m.ktp_file_url, m.nib_file_url, m.sample_product_images
       FROM users u
       LEFT JOIN mitra_profiles m ON u.id = m.user_id
       WHERE u.id = ?`, [userId]);
        return res.status(200).json({
            success: true,
            message: 'Profil berhasil diperbarui',
            data: rows && rows.length > 0 ? rows[0] : null
        });
    }
    catch (error) {
        console.error('Error updateProfile:', error);
        return res.status(500).json({ success: false, message: 'Gagal memperbarui profil' });
    }
};
exports.updateProfile = updateProfile;
const otpStore = new Map();
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
const transporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: process.env['EMAIL_USER'],
        pass: process.env['EMAIL_PASS'], // Pastikan pakai 16-digit App Password dari Google
    },
});
// ============================================================
// FORGOT PASSWORD Ã¢â‚¬â€ Kirim OTP ke email user
// ============================================================
const forgotPassword = async (req, res) => {
    console.log("=== API FORGOT PASSWORD DI-HIT ===", req.body);
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ success: false, message: 'Email wajib diisi' });
            return;
        }
        // 1. Cek apakah user ada di database
        const [users] = await database_1.default.query('SELECT id, name, email FROM users WHERE email = ?', [email]);
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
                console.log(`Ã¢Å“â€¦ [OTP] Email OTP berhasil dikirim ke ${email}`);
            }
            catch (mailError) {
                console.error('Ã¢Å¡Â Ã¯Â¸Â [OTP] Gagal mengirim email via Nodemailer:', mailError);
            }
        }
        else {
            console.log('Ã¢Å¡Â Ã¯Â¸Â [OTP] EMAIL_USER/EMAIL_PASS belum dikonfigurasi. Gunakan kode OTP dari log terminal di atas.');
        }
        res.status(200).json({
            success: true,
            message: `Instruksi reset kata sandi telah dikirimkan ke ${email}`,
        });
        return;
    }
    catch (error) {
        console.error('Error forgot password:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat mengirim email' });
        return;
    }
};
exports.forgotPassword = forgotPassword;
// ============================================================
// VERIFY OTP Ã¢â‚¬â€ Validasi kode OTP yang dimasukkan user
// ============================================================
const verifyOtp = async (req, res) => {
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
    }
    catch (error) {
        console.error('Error verify OTP:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server',
        });
        return;
    }
};
exports.verifyOtp = verifyOtp;
// ============================================================
// RESET PASSWORD Ã¢â‚¬â€ Ubah kata sandi setelah OTP terverifikasi
// ============================================================
const resetPassword = async (req, res) => {
    try {
        const { email, newPassword, otp } = req.body;
        if (!email || !newPassword) {
            res.status(400).json({ success: false, message: 'Email dan kata sandi baru wajib diisi' });
            return;
        }
        if (newPassword.length < 6) {
            res.status(400).json({ success: false, message: 'Kata sandi minimal 6 karakter' });
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
        const [users] = await database_1.default.query('SELECT id FROM users WHERE email = ?', [email]);
        if (!users || users.length === 0) {
            res.status(404).json({ success: false, message: 'Akun dengan email tersebut tidak ditemukan' });
            return;
        }
        const passwordHash = await bcrypt_1.default.hash(newPassword, 10);
        await database_1.default.query('UPDATE users SET password_hash = ? WHERE email = ?', [passwordHash, email]);
        // Hapus OTP dari store setelah berhasil reset
        otpStore.delete(email.toLowerCase());
        res.status(200).json({
            success: true,
            message: 'Kata sandi berhasil diperbarui',
        });
        return;
    }
    catch (error) {
        console.error('Error reset password:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server',
        });
        return;
    }
};
exports.resetPassword = resetPassword;
const reuploadDocs = async (req, res) => {
    try {
        const userId = res.locals['userId'];
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const files = req.files;
        const ktpFile = files?.ktp_file?.[0];
        const nibFile = files?.nib_file?.[0];
        const productImages = files?.product_images || files?.sample_product_images;
        if (!ktpFile && !nibFile && (!productImages || productImages.length === 0)) {
            res.status(400).json({ success: false, message: 'Harap unggah minimal satu dokumen untuk diperbaiki.' });
            return;
        }
        const updates = [];
        const params = [];
        if (ktpFile) {
            updates.push('ktp_file_url = ?');
            params.push(`/uploads/${ktpFile.filename}`);
        }
        if (nibFile) {
            updates.push('nib_file_url = ?');
            params.push(`/uploads/${nibFile.filename}`);
        }
        if (productImages && productImages.length > 0) {
            updates.push('sample_product_images = ?');
            params.push(JSON.stringify(productImages.map(f => `/uploads/${f.filename}`)));
        }
        updates.push('is_verified = 0');
        updates.push('is_active = 1');
        updates.push('rejection_reason = NULL');
        updates.push('updated_at = NOW()');
        params.push(userId);
        await database_1.default.query(`UPDATE mitra_profiles SET ${updates.join(', ')} WHERE user_id = ?`, params);
        res.status(200).json({
            success: true,
            message: 'Dokumen berhasil diperbarui dan diajukan ulang untuk verifikasi admin!'
        });
    }
    catch (error) {
        console.error('Error reuploadDocs:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui dokumen.' });
    }
};
exports.reuploadDocs = reuploadDocs;
const checkUsername = async (req, res) => {
    try {
        const username = String(req.query.username || '').trim();
        if (!username) {
            res.status(400).json({ success: false, available: false, message: 'Username wajib diisi' });
            return;
        }
        const [rows] = await database_1.default.query('SELECT id FROM users WHERE LOWER(name) = LOWER(?) LIMIT 1', [username]);
        const available = !rows || rows.length === 0;
        res.status(200).json({
            success: true,
            available,
            message: available ? 'Username tersedia' : 'Username sudah digunakan',
        });
    }
    catch (error) {
        console.error('Error checkUsername:', error);
        res.status(500).json({ success: false, available: true, message: 'Terjadi kesalahan server' });
    }
};
exports.checkUsername = checkUsername;
const verifyRegisterOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            res.status(400).json({ success: false, message: 'Email dan kode OTP wajib diisi' });
            return;
        }
        const normalizedEmail = String(email).trim().toLowerCase();
        const entry = otpStore.get(normalizedEmail);
        if (entry && entry.code !== String(otp)) {
            res.status(400).json({ success: false, message: 'Kode OTP salah' });
            return;
        }
        if (entry) {
            otpStore.delete(normalizedEmail);
        }
        const [users] = await database_1.default.query('SELECT id, name, email, role, phone, avatar_url FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
        const user = users && users.length > 0 ? users[0] : null;
        const jwtSecret = process.env['JWT_SECRET'] || 'your_super_secret_jwt_key_min_32_chars';
        const jwtExpiresIn = process.env['JWT_EXPIRES_IN'] || '7d';
        const token = user
            ? jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: jwtExpiresIn })
            : null;
        res.status(200).json({
            success: true,
            message: 'Verifikasi berhasil',
            token,
            data: user ? { ...user, token } : null,
        });
    }
    catch (error) {
        console.error('Error verifyRegisterOtp:', error);
        res.status(500).json({ success: false, message: 'Gagal memverifikasi OTP' });
    }
};
exports.verifyRegisterOtp = verifyRegisterOtp;
const resendRegisterOtp = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ success: false, message: 'Email wajib diisi' });
            return;
        }
        const normalizedEmail = String(email).trim().toLowerCase();
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000;
        otpStore.set(normalizedEmail, { code: otp, email: normalizedEmail, verified: false, expiresAt });
        console.log(`[DEV REGISTER OTP] Kode OTP untuk ${normalizedEmail}: ${otp}`);
        res.status(200).json({
            success: true,
            message: 'Kode OTP baru telah dikirim',
        });
    }
    catch (error) {
        console.error('Error resendRegisterOtp:', error);
        res.status(500).json({ success: false, message: 'Gagal mengirim ulang OTP' });
    }
};
exports.resendRegisterOtp = resendRegisterOtp;
//# sourceMappingURL=authController.js.map