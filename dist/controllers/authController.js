"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshToken = exports.checkUsername = exports.resendRegisterOtp = exports.verifyRegisterOtp = exports.reuploadDocs = exports.resetPassword = exports.verifyOtp = exports.forgotPassword = exports.updateProfile = exports.getProfile = exports.googleLogin = exports.loginMitra = exports.login = exports.registerMitra = exports.saveFcmToken = exports.registerCustomer = void 0;
const emailService_js_1 = require("../utils/emailService.js");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const google_auth_library_1 = require("google-auth-library");
const database_1 = __importDefault(require("../config/database"));
const signTokenPair = (user) => {
    const jwtSecret = process.env['JWT_SECRET'];
    if (!jwtSecret)
        throw new Error('JWT_SECRET tidak ditemukan di environment variables!');
    const refreshSecret = process.env['JWT_REFRESH_SECRET'] || jwtSecret;
    const jwtExpiresIn = process.env['JWT_EXPIRES_IN'] || '7d';
    const refreshExpiresIn = process.env['JWT_REFRESH_EXPIRES_IN'] || '30d';
    const ver = user.ver ?? 0;
    const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role, ver }, jwtSecret, { expiresIn: jwtExpiresIn });
    const refresh_token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role, ver, type: 'refresh' }, refreshSecret, { expiresIn: refreshExpiresIn });
    return { token, refresh_token };
};
const registerCustomer = async (req, res) => {
    try {
        const { name, email, password, phone, username, google_id, avatar_url, isGoogleAuth } = req.body;
        const isGoogle = Boolean(isGoogleAuth || google_id);
        if (!name || !email) {
            res.status(400).json({
                success: false,
                message: 'Nama dan email wajib diisi',
                meta: { timestamp: new Date().toISOString() }
            });
            return;
        }
        const cleanEmail = email.trim().toLowerCase();
        const cleanUsername = username ? String(username).trim().toLowerCase() : null;
        if (cleanUsername) {
            const [existingUsernames] = await database_1.default.query('SELECT id FROM users WHERE username = ?', [cleanUsername]);
            if (existingUsernames && existingUsernames.length > 0) {
                res.status(409).json({
                    success: false,
                    message: 'Username sudah digunakan. Silakan pilih username lain.',
                    meta: { timestamp: new Date().toISOString() }
                });
                return;
            }
        }
        // 1. Cek apakah email sudah terdaftar di database
        const [existingUsers] = await database_1.default.query('SELECT id, name, email, role, google_id, avatar_url, token_version FROM users WHERE email = ?', [cleanEmail]);
        if (existingUsers && existingUsers.length > 0) {
            const existing = existingUsers[0];
            if (isGoogle && !existing.google_id) {
                // Tautkan akun Google ke pengguna yang sudah terdaftar
                await database_1.default.query('UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?) WHERE id = ?', [google_id || null, avatar_url || null, existing.id]);
                const { token, refresh_token } = signTokenPair({ id: existing.id, email: cleanEmail, role: existing.role, ver: existing.token_version });
                res.status(200).json({
                    success: true,
                    message: 'Akun Google berhasil dihubungkan!',
                    data: {
                        token,
                        refresh_token,
                        id: existing.id,
                        name: existing.name,
                        email: cleanEmail,
                        role: existing.role,
                    },
                    meta: { timestamp: new Date().toISOString() }
                });
                return;
            }
            res.status(409).json({
                success: false,
                message: 'Email sudah terdaftar. Silakan langsung masuk ke akun Anda.',
                meta: { timestamp: new Date().toISOString() }
            });
            return;
        }
        // 2. Jika pendaftaran lewat Google: langsung aktifkan tanpa OTP
        if (isGoogle) {
            const passwordHash = password ? await bcrypt_1.default.hash(password, 10) : null;
            const [result] = await database_1.default.query('INSERT INTO users (name, username, email, password_hash, role, is_active, google_id, avatar_url) VALUES (?, ?, ?, ?, "pengunjung", 1, ?, ?)', [name.trim(), cleanUsername, cleanEmail, passwordHash, google_id || null, avatar_url || null]);
            const newUserId = result.insertId;
            if (phone && phone.trim()) {
                await database_1.default.query('INSERT INTO user_addresses (user_id, recipient_name, phone, full_address, is_default) VALUES (?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE phone = VALUES(phone)', [newUserId, name.trim(), phone.trim(), 'Belum ada alamat lengkap']).catch(() => { });
            }
            const { token, refresh_token } = signTokenPair({ id: newUserId, email: cleanEmail, role: 'pengunjung' });
            res.status(201).json({
                success: true,
                message: 'Pendaftaran pengunjung berhasil!',
                data: {
                    token,
                    refresh_token,
                    id: newUserId,
                    name: name.trim(),
                    email: cleanEmail,
                    role: 'pengunjung',
                    avatar_url: avatar_url || null,
                },
                meta: { timestamp: new Date().toISOString() }
            });
            return;
        }
        // 3. Jika pendaftaran manual (bukan Google): Wajibkan password dan kirim OTP verifikasi email
        if (!password || password.length < 6) {
            res.status(400).json({
                success: false,
                message: 'Password minimal 6 karakter',
                meta: { timestamp: new Date().toISOString() }
            });
            return;
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000;
        otpStore.set(cleanEmail, {
            code: otp,
            email: cleanEmail,
            expiresAt,
            verified: false,
            type: 'register',
            data: {
                name: name.trim(),
                username: cleanUsername,
                email: cleanEmail,
                password,
                phone: phone ? phone.trim() : null,
            },
        });
        console.log('\n========================================');
        console.log(`[DEV REGISTER OTP] Kode OTP untuk ${cleanEmail}: ${otp}`);
        console.log('========================================\n');
        try {
            await (0, emailService_js_1.sendOTPEmail)(cleanEmail, otp, name.trim());
            console.log(`✅ [OTP EMAIL] Email OTP pendaftaran berhasil terkirim ke ${cleanEmail}`);
        }
        catch (err) {
            console.error('⚠️ [OTP EMAIL] Gagal mengirim email OTP pendaftaran:', err.message);
        }
        res.status(200).json({
            success: true,
            requires_otp: true,
            message: 'Kode OTP verifikasi telah dikirim ke email Anda. Silakan verifikasi untuk menyelesaikan pendaftaran.',
            data: {
                email: cleanEmail,
                requires_otp: true,
            },
            meta: { timestamp: new Date().toISOString() }
        });
        return;
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
            res.status(400).json({ success: false, message: 'Semua data teks wajib diisi' });
            return;
        }
        const nameRegex = /^[a-zA-Z\s]+$/;
        if (!nameRegex.test(name.trim())) {
            await connection.rollback();
            res.status(400).json({ success: false, message: 'Format nama tidak valid (hanya huruf dan spasi)' });
            return;
        }
        const phoneRegex = /^[0-9]+$/;
        if (!phoneRegex.test(whatsapp_number.trim())) {
            await connection.rollback();
            res.status(400).json({ success: false, message: 'Nomor HP hanya boleh berisi angka' });
            return;
        }
        if (whatsapp_number.trim().length < 10 || whatsapp_number.trim().length > 14) {
            await connection.rollback();
            res.status(400).json({ success: false, message: 'Nomor HP harus 10-14 digit' });
            return;
        }
        if (!files || !files.ktp_file || !files.nib_file || !files.product_images) {
            await connection.rollback();
            res.status(400).json({ success: false, message: 'File KTP, NIB, dan Foto Produk wajib diunggah' });
            return;
        }
        const [existingUsers] = await connection.query('SELECT id, role FROM users WHERE email = ?', [email]);
        let newUserId;
        if (existingUsers.length > 0) {
            const existingUser = existingUsers[0];
            const [existingProfile] = await connection.query('SELECT id, ktp_file_url FROM mitra_profiles WHERE user_id = ?', [existingUser.id]);
            if (existingProfile.length > 0 && existingProfile[0].ktp_file_url) {
                await connection.rollback();
                res.status(409).json({ success: false, message: 'Email sudah terdaftar sebagai Mitra' });
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
         ktp_file_url = ?, nib_file_url = ?, sample_product_images = ?, is_verified = 0, is_active = 1
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
// Login umum yang mendukung peran pengunjung, mitra, dan admin
const login = async (req, res) => {
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
      SELECT u.id, u.name, u.email, u.password_hash, u.role, u.is_active, u.avatar_url, u.token_version,
             m.store_name, m.is_verified, m.rejection_reason
      FROM users u 
      LEFT JOIN mitra_profiles m ON u.id = m.user_id 
      WHERE u.email = ?
      LIMIT 1
    `;
        const [users] = await database_1.default.query(query, [email.trim().toLowerCase()]);
        if (users.length === 0) {
            res.status(401).json({
                success: false,
                message: 'Email atau password salah',
                meta: { timestamp: new Date().toISOString() }
            });
            return;
        }
        const user = users[0];
        if (user.is_active === 0) {
            res.status(403).json({
                success: false,
                message: 'Akun Anda sedang dinonaktifkan.',
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
        const isMatch = await bcrypt_1.default.compare(password, user.password_hash);
        if (!isMatch) {
            res.status(401).json({
                success: false,
                message: 'Email atau password salah!',
                meta: { timestamp: new Date().toISOString() }
            });
            return;
        }
        const { token, refresh_token } = signTokenPair({ id: user.id, email: user.email, role: user.role, ver: user.token_version });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000
        });
        res.status(200).json({
            success: true,
            message: 'Login berhasil!',
            data: {
                token: token,
                refresh_token: refresh_token,
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar_url: user.avatar_url,
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
        console.error('Error login:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server.',
            meta: { timestamp: new Date().toISOString() }
        });
        return;
    }
};
exports.login = login;
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
      SELECT u.id, u.name, u.email, u.password_hash, u.role, u.is_active, u.token_version,
             m.store_name, m.is_verified, m.rejection_reason
      FROM users u 
      LEFT JOIN mitra_profiles m ON u.id = m.user_id 
      WHERE u.email = ?
    `;
        const [users] = await database_1.default.query(query, [email.trim().toLowerCase()]);
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
                message: 'Email atau password salah!',
                meta: { timestamp: new Date().toISOString() }
            });
            return;
        }
        const { token, refresh_token } = signTokenPair({ id: user.id, email: user.email, role: user.role, ver: user.token_version });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000
        });
        res.status(200).json({
            success: true,
            message: 'Login berhasil!',
            data: {
                token: token,
                refresh_token: refresh_token,
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
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
            message: 'Terjadi kesalahan pada server.',
            meta: { timestamp: new Date().toISOString() }
        });
        return;
    }
};
exports.loginMitra = loginMitra;
const googleLogin = async (req, res) => {
    try {
        const { credential, id_token, token: tokenParam, userInfo, is_register, action, role = 'pengunjung', phone } = req.body;
        const tokenToVerify = credential || id_token || tokenParam;
        if (!tokenToVerify && !userInfo) {
            res.status(400).json({ success: false, message: 'Data otentikasi Google wajib dikirim' });
            return;
        }
        let email = '';
        let name = '';
        let googleId = '';
        let avatarUrl = null;
        if (tokenToVerify) {
            try {
                const client = new google_auth_library_1.OAuth2Client();
                const validAudiences = [
                    process.env['GOOGLE_CLIENT_ID'],
                    process.env['GOOGLE_CLIENT_ID_WEB'],
                    process.env['GOOGLE_CLIENT_ID_MOBILE'],
                    process.env['GOOGLE_CLIENT_ID_ALT'],
                    '379734738528-dc5htqtqu1k8qn5khubul347aghuka6r.apps.googleusercontent.com'
                ].filter((id) => Boolean(id && typeof id === 'string' && id.trim().length > 0));
                const ticket = await client.verifyIdToken({
                    idToken: tokenToVerify,
                    audience: validAudiences.length > 0 ? validAudiences : undefined,
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
                    const parts = tokenToVerify.split('.');
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
            res.status(400).json({ success: false, message: 'Gagal mendapatkan data akun dari Google' });
            return;
        }
        const query = `
      SELECT u.id, u.name, u.email, u.role, u.is_active, u.google_id, u.avatar_url, u.token_version,
             m.store_name, m.is_verified, m.rejection_reason
      FROM users u 
      LEFT JOIN mitra_profiles m ON u.id = m.user_id 
      WHERE (u.google_id IS NOT NULL AND u.google_id = ?) OR u.email = ?
      LIMIT 1
    `;
        const [users] = await database_1.default.query(query, [googleId || 'NON_EXISTENT_ID', email.trim().toLowerCase()]);
        let user;
        if (users.length > 0) {
            user = users[0];
            if (user.is_active === 0) {
                res.status(403).json({ success: false, message: 'Akun Anda sedang dinonaktifkan.' });
                return;
            }
            if (user.role !== 'mitra' && user.role !== 'admin' && user.role !== 'pengunjung') {
                res.status(403).json({ success: false, message: 'Akses ditolak. Peran pengguna tidak diizinkan.' });
                return;
            }
            if (!user.google_id || !user.avatar_url) {
                await database_1.default.query('UPDATE users SET google_id = COALESCE(google_id, ?), avatar_url = COALESCE(avatar_url, ?) WHERE id = ?', [googleId || null, avatarUrl || null, user.id]);
            }
        }
        else {
            // Akun Google BELUM terdaftar di database
            const isRegisterIntent = Boolean(is_register === true || action === 'register');
            if (!isRegisterIntent) {
                // Alur Login: JANGAN buat akun otomatis. Berikan sinyal 404 & is_registered: false
                res.status(404).json({
                    success: false,
                    is_registered: false,
                    message: 'Akun Google belum terdaftar. Silakan lakukan pendaftaran terlebih dahulu.',
                    data: {
                        email: email.trim().toLowerCase(),
                        name,
                        avatar_url: avatarUrl,
                        google_id: googleId,
                    },
                    meta: { timestamp: new Date().toISOString() }
                });
                return;
            }
            // Alur Register: Daftarkan pengguna baru dengan aman
            const connection = await database_1.default.getConnection();
            try {
                await connection.beginTransaction();
                const targetRole = (role === 'pengunjung') ? 'pengunjung' : 'mitra';
                const [insertUser] = await connection.query('INSERT INTO users (name, email, password_hash, role, is_active, google_id, avatar_url) VALUES (?, ?, NULL, ?, 1, ?, ?)', [name, email.trim().toLowerCase(), targetRole, googleId || null, avatarUrl || null]);
                const newUserId = insertUser.insertId;
                if (targetRole === 'mitra') {
                    await connection.query(`INSERT INTO mitra_profiles 
             (user_id, whatsapp_number, store_name, workshop_address, started_year, ktp_file_url, nib_file_url, sample_product_images, is_verified, is_active) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`, [
                        newUserId,
                        phone ? phone.trim() : '-',
                        'Toko ' + name,
                        '-',
                        new Date().getFullYear(),
                        '',
                        '',
                        '[]'
                    ]);
                }
                else if (phone && phone.trim()) {
                    await connection.query('INSERT INTO user_addresses (user_id, recipient_name, phone, full_address, is_default) VALUES (?, ?, ?, ?, 1)', [newUserId, name, phone.trim(), 'Belum ada alamat lengkap']).catch(() => { });
                }
                await connection.commit();
                user = {
                    id: newUserId,
                    name,
                    email: email.trim().toLowerCase(),
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
        const { token, refresh_token } = signTokenPair({ id: user.id, email: user.email, role: user.role, ver: user.token_version });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000
        });
        res.status(200).json({
            success: true,
            is_registered: true,
            message: users.length > 0 ? 'Login dengan Google berhasil!' : 'Pendaftaran dengan Google berhasil!',
            token,
            data: {
                token,
                refresh_token,
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                store_name: user.store_name,
                is_verified: user.is_verified,
                rejection_reason: user.rejection_reason,
                avatar_url: user.avatar_url || avatarUrl
            },
            meta: { timestamp: new Date().toISOString() }
        });
        return;
    }
    catch (error) {
        console.error('Error google login:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat otentikasi Google' });
        return;
    }
};
exports.googleLogin = googleLogin;
const getProfile = async (_req, res) => {
    try {
        const userId = res.locals['userId'];
        if (!userId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const [rows] = await database_1.default.query(`SELECT u.id, u.name, u.email, u.role, u.avatar_url,
              u.phone, u.birth_date, u.gender,
              SUBSTRING_INDEX(u.email, '@', 1) AS username,
              m.store_name, m.whatsapp_number, m.workshop_address, 
              m.started_year, m.description, m.website, m.instagram, 
              m.banner_url, m.is_verified, m.rejection_reason,
              m.ktp_file_url, m.nib_file_url, m.sample_product_images
       FROM users u
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
        const ownerName = req.body.ownerName ?? req.body.nama;
        const storeName = req.body.storeName ?? req.body.nama_toko;
        const phone = req.body.phone ?? req.body.whatsapp_number;
        const address = req.body.address ?? req.body.alamat ?? req.body.workshop_address;
        const yearStarted = req.body.yearStarted ?? req.body.tahun_mulai ?? req.body.started_year;
        const description = req.body.description ?? req.body.deskripsi;
        const website = req.body.website;
        const instagram = req.body.instagram;
        const files = req.files;
        const avatarPath = files?.['avatar']?.[0] ? `/uploads/${files['avatar'][0].filename}` : null;
        const bannerPath = files?.['banner']?.[0] ? `/uploads/${files['banner'][0].filename}` : null;
        const birthDate = req.body.birthDate ?? req.body.birth_date ?? null;
        const gender = req.body.gender ?? null;
        // Update data akun di tabel users (semua role)
        await database_1.default.query(`UPDATE users 
       SET name = COALESCE(?, name), 
           avatar_url = COALESCE(?, avatar_url),
           phone = COALESCE(?, phone),
           birth_date = COALESCE(?, birth_date),
           gender = COALESCE(?, gender)
       WHERE id = ?`, [
            ownerName ?? null,
            avatarPath,
            phone ?? null,
            birthDate ? String(birthDate).slice(0, 10) : null,
            ['L', 'P'].includes(gender) ? gender : null,
            userId
        ]);
        const [roleRows] = await database_1.default.query('SELECT role FROM users WHERE id = ?', [userId]);
        const userRole = roleRows?.[0]?.role;
        // Perilaku mitra: profil toko ikut diperbarui. Customer (pengunjung)
        // TIDAK boleh membuat baris mitra_profiles palsu.
        if (userRole === 'pengunjung') {
            const [rows2] = await database_1.default.query(`SELECT u.id, u.name, u.username, u.email, u.role, u.avatar_url,
                u.phone, u.birth_date, u.gender
         FROM users u WHERE u.id = ?`, [userId]);
            return res.status(200).json({
                success: true,
                message: 'Profil berhasil diperbarui',
                data: rows2 && rows2.length > 0 ? rows2[0] : null
            });
        }
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
             banner_url = COALESCE(?, banner_url)
         WHERE user_id = ?`, [
                storeName ?? null,
                phone ?? null,
                address ?? null,
                yearStarted ? parseInt(String(yearStarted), 10) : null,
                description ?? null,
                website ?? null,
                instagram ?? null,
                bannerPath,
                userId
            ]);
        }
        else {
            // Buat baru jika belum ada
            await database_1.default.query(`INSERT INTO mitra_profiles 
         (user_id, store_name, whatsapp_number, workshop_address, started_year, description, website, instagram, banner_url, is_verified, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`, [
                userId,
                storeName ?? null,
                phone ?? null,
                address ?? null,
                yearStarted ? parseInt(String(yearStarted), 10) : null,
                description ?? null,
                website ?? null,
                instagram ?? null,
                bannerPath
            ]);
        }
        // Ambil data profil terbaru
        const [rows] = await database_1.default.query(`SELECT u.id, u.name, u.username, u.email, u.role, u.avatar_url,
              u.phone, u.birth_date, u.gender,
              m.store_name, m.whatsapp_number, m.workshop_address, 
              m.started_year, m.description, m.website, m.instagram, 
              m.banner_url, m.is_verified
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
        const cleanEmail = email.trim().toLowerCase();
        // 1. Cek apakah user ada di database
        const [users] = await database_1.default.query('SELECT id, name, email FROM users WHERE LOWER(TRIM(email)) = ?', [cleanEmail]);
        if (!users || users.length === 0) {
            res.status(404).json({ success: false, message: 'Akun dengan email tersebut tidak ditemukan.' });
            return;
        }
        const user = users[0];
        // 2. Buat Kode OTP 6 Digit Angka
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        // 3. Simpan OTP ke memory (otpStore) agar bisa dicek oleh fungsi resetPassword nanti
        const expiresAt = Date.now() + 5 * 60 * 1000; // Kadaluarsa dalam 5 menit
        otpStore.set(cleanEmail, { code: otp, email: cleanEmail, verified: false, expiresAt });
        try {
            const expiresDate = new Date(Date.now() + 5 * 60 * 1000);
            await database_1.default.query('INSERT INTO user_otps (user_id, otp_code, otp_type, expires_at, is_used) VALUES (?, ?, ?, ?, 0)', [user.id, otp, 'reset_password', expiresDate]);
        }
        catch (otpErr) {
            console.warn('⚠️ Gagal menyimpan OTP ke database (fallback memory tetap aktif):', otpErr);
        }
        // 4. Print ke terminal (Biar kamu tidak perlu nunggu email masuk saat testing!)
        console.log(`\n========================================`);
        console.log(`[DEV OTP] Kode OTP untuk ${cleanEmail}: ${otp}`);
        console.log(`========================================\n`);
        // 5. Kirim OTP via Email dengan Template Branded DinoyoCraft & Logo Project
        const logoUrl = 'https://raw.githubusercontent.com/alifarda126/DinoyoCraftApp/main/assets/images/branding/logo_icon_circle.png';
        const mailOptions = {
            from: `"DinoyoCraft Portal" <${process.env['EMAIL_USER'] || 'csdinoyocraft@gmail.com'}>`,
            to: cleanEmail,
            subject: 'Kode OTP Verifikasi Lupa Kata Sandi - DinoyoCraft',
            html: `
        <!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Kode OTP DinoyoCraft</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #F8F6F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8F6F2; padding: 40px 15px;">
            <tr>
              <td align="center">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(184, 92, 60, 0.08); border: 1px solid #ECE3DA;">
                  
                  <!-- Top Accent Banner -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #B85C3C 0%, #8C4328 100%); height: 8px;"></td>
                  </tr>

                  <!-- Card Content -->
                  <tr>
                    <td style="padding: 40px 36px 36px;">
                      
                      <!-- Brand Header with Logo -->
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                        <tr>
                          <td align="center">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 12px;">
                              <tr>
                                <td align="center" style="width: 76px; height: 76px; background-color: #FFFFFF !important; border-radius: 50%; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12); border: 2px solid #ECE3DA; padding: 0;">
                                  <img src="${logoUrl}" alt="DinoyoCraft Logo" width="76" height="76" style="width: 76px; height: 76px; border-radius: 50%; display: block; border: 0; background-color: #FFFFFF;" />
                                </td>
                              </tr>
                            </table>
                            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #2D2A26; letter-spacing: -0.03em;">DinoyoCraft</h1>
                            <p style="margin: 4px 0 0; font-size: 12px; font-weight: 700; color: #B85C3C; letter-spacing: 0.08em; text-transform: uppercase;">Sentra Kerajinan Keramik Dinoyo Malang</p>
                          </td>
                        </tr>
                      </table>

                      <div style="height: 1px; background-color: #ECE3DA; margin-bottom: 24px;"></div>

                      <!-- Content Body -->
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td style="color: #4A4641; font-size: 15px; line-height: 1.65;">
                            <p style="margin: 0 0 14px; font-size: 17px; font-weight: 700; color: #2D2A26;">
                              Permintaan Reset Kata Sandi
                            </p>
                            <p style="margin: 0 0 10px;">
                              Halo <strong style="color: #2D2A26;">${user.name}</strong>,
                            </p>
                            <p style="margin: 0 0 20px; color: #66615B; font-size: 14.5px;">
                              Kami menerima permintaan untuk mengatur ulang kata sandi akun DinoyoCraft Anda. Masukkan kode One-Time Password (OTP) berikut untuk menyelesaikan verifikasi:
                            </p>
                          </td>
                        </tr>

                        <!-- OTP Box -->
                        <tr>
                          <td align="center">
                            <div style="background: linear-gradient(135deg, #FFF9F6 0%, #FDF3EB 100%); border: 2px dashed #B85C3C; border-radius: 16px; padding: 22px 16px; margin: 0 auto 24px; text-align: center;">
                              <span style="display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: #8C4328; text-transform: uppercase; margin-bottom: 8px;">
                                Kode Verifikasi OTP Anda
                              </span>
                              <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #B85C3C; text-indent: 10px; padding: 4px 0;">
                                ${otp}
                              </div>
                              <div style="margin-top: 10px;">
                                <span style="display: inline-block; background: #FEE2E2; color: #DC2626; padding: 4px 14px; border-radius: 999px; font-size: 12px; font-weight: 600;">
                                  ⏱️ Berlaku selama 5 menit
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>

                        <!-- Security Notice Box -->
                        <tr>
                          <td>
                            <div style="background-color: #FAF8F5; border-left: 4px solid #B85C3C; border-radius: 0 10px 10px 0; padding: 14px 16px; margin-bottom: 28px;">
                              <p style="margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #2D2A26;">
                                🛡️ Catatan Keamanan:
                              </p>
                              <p style="margin: 0; font-size: 12.5px; color: #706B65; line-height: 1.55;">
                                &bull; Jangan pernah membagikan kode OTP ini kepada siapa pun, termasuk pihak yang mengatasnamakan DinoyoCraft.<br/>
                                &bull; Jika Anda tidak meminta reset kata sandi, abaikan email ini. Kata sandi akun Anda tetap aman tanpa perubahan.
                              </p>
                            </div>
                          </td>
                        </tr>

                        <!-- Support & Closing -->
                        <tr>
                          <td style="border-top: 1px solid #ECE3DA; padding-top: 24px; text-align: center;">
                            <p style="margin: 0 0 6px; font-size: 12px; color: #8A7968;">
                              Butuh bantuan? Hubungi Tim Dukungan DinoyoCraft di <a href="mailto:csdinoyocraft@gmail.com" style="color: #B85C3C; font-weight: 600; text-decoration: none;">csdinoyocraft@gmail.com</a>
                            </p>
                            <p style="margin: 0; font-size: 11px; color: #A89B8C; line-height: 1.5;">
                              Sentra Kerajinan Keramik Dinoyo, Kota Malang, Jawa Timur<br/>
                              &copy; ${new Date().getFullYear()} DinoyoCraft. Hak Cipta Dilindungi.
                            </p>
                          </td>
                        </tr>

                      </table>

                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
        };
        // Kirim jika konfigurasi email terisi
        if (process.env['EMAIL_USER'] && process.env['EMAIL_PASS'] && process.env['EMAIL_PASS'] !== 'xxxx xxxx xxxx xxxx') {
            try {
                const mailTransporter = (0, emailService_js_1.getTransporter)();
                await mailTransporter.sendMail(mailOptions);
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
            message: `Kode OTP verifikasi telah dikirimkan ke email ${cleanEmail}`,
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
        const cleanEmail = email.toString().trim().toLowerCase();
        const cleanOtp = otp.toString().trim();
        let entry = otpStore.get(cleanEmail);
        if (!entry) {
            // Fallback pengecekan ke tabel database user_otps untuk lingkungan Serverless
            const [dbOtps] = await database_1.default.query(`SELECT o.id, o.otp_code, o.expires_at 
         FROM user_otps o
         JOIN users u ON o.user_id = u.id
         WHERE LOWER(TRIM(u.email)) = ? AND o.otp_code = ? AND o.is_used = 0 AND o.expires_at > NOW()
         ORDER BY o.id DESC LIMIT 1`, [cleanEmail, cleanOtp]);
            if (dbOtps && dbOtps.length > 0) {
                entry = {
                    code: cleanOtp,
                    email: cleanEmail,
                    verified: true,
                    expiresAt: Date.now() + 5 * 60 * 1000,
                };
                otpStore.set(cleanEmail, entry);
                await database_1.default.query('UPDATE user_otps SET is_used = 1 WHERE id = ?', [dbOtps[0].id]);
            }
        }
        if (!entry) {
            res.status(400).json({
                success: false,
                message: 'Kode OTP tidak ditemukan. Silakan minta kode OTP baru.',
            });
            return;
        }
        if (Date.now() > entry.expiresAt) {
            otpStore.delete(cleanEmail);
            res.status(400).json({
                success: false,
                message: 'Kode OTP telah kedaluwarsa. Silakan minta kode OTP baru.',
            });
            return;
        }
        if (entry.code !== cleanOtp) {
            res.status(400).json({
                success: false,
                message: 'Kode OTP salah. Periksa kembali kode yang Anda masukkan.',
            });
            return;
        }
        // Tandai OTP sebagai verified
        entry.verified = true;
        otpStore.set(cleanEmail, entry);
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
        if (newPassword.length < 8) {
            res.status(400).json({ success: false, message: 'Kata sandi minimal 8 karakter' });
            return;
        }
        // Cek OTP terverifikasi atau kode OTP cocok
        const cleanEmail = email.toString().trim().toLowerCase();
        const cleanOtp = otp.toString().trim();
        let entry = otpStore.get(cleanEmail);
        if (!entry) {
            // Fallback pengecekan ke tabel database user_otps untuk lingkungan Serverless
            const [dbOtps] = await database_1.default.query(`SELECT o.id, o.otp_code, o.expires_at 
         FROM user_otps o
         JOIN users u ON o.user_id = u.id
         WHERE LOWER(TRIM(u.email)) = ? AND o.otp_code = ? AND o.is_used = 0 AND o.expires_at > NOW()
         ORDER BY o.id DESC LIMIT 1`, [cleanEmail, cleanOtp]);
            if (dbOtps && dbOtps.length > 0) {
                entry = {
                    code: cleanOtp,
                    email: cleanEmail,
                    verified: true,
                    expiresAt: Date.now() + 5 * 60 * 1000,
                };
                otpStore.set(cleanEmail, entry);
                await database_1.default.query('UPDATE user_otps SET is_used = 1 WHERE id = ?', [dbOtps[0].id]);
            }
        }
        const isOtpValid = entry && (entry.verified || (cleanOtp && entry.code === cleanOtp));
        if (!entry || !isOtpValid) {
            res.status(400).json({
                success: false,
                message: 'OTP belum diverifikasi atau tidak valid. Silakan verifikasi OTP terlebih dahulu.',
            });
            return;
        }
        if (Date.now() > entry.expiresAt) {
            otpStore.delete(cleanEmail);
            res.status(400).json({
                success: false,
                message: 'Sesi reset telah kedaluwarsa. Silakan ulangi proses dari awal.',
            });
            return;
        }
        const [users] = await database_1.default.query('SELECT id FROM users WHERE LOWER(TRIM(email)) = ?', [cleanEmail]);
        if (!users || users.length === 0) {
            res.status(404).json({ success: false, message: 'Akun dengan email tersebut tidak ditemukan' });
            return;
        }
        const passwordHash = await bcrypt_1.default.hash(newPassword, 10);
        await database_1.default.query('UPDATE users SET password_hash = ? WHERE LOWER(TRIM(email)) = ?', [passwordHash, cleanEmail]);
        // Hapus OTP dari store setelah berhasil reset
        otpStore.delete(cleanEmail);
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
// ============================================================
// VERIFIKASI OTP REGISTRASI MANUAL PENGUNJUNG
// ============================================================
const verifyRegisterOtp = async (req, res) => {
    try {
        const { email, otp, name, password, phone } = req.body;
        if (!email || !otp) {
            res.status(400).json({ success: false, message: 'Email dan kode OTP wajib diisi' });
            return;
        }
        const cleanEmail = email.trim().toLowerCase();
        const entry = otpStore.get(cleanEmail);
        if (!entry || entry.type !== 'register') {
            res.status(400).json({
                success: false,
                message: 'Kode OTP pendaftaran tidak ditemukan atau sudah kadaluwarsa. Silakan minta kode baru.',
            });
            return;
        }
        if (Date.now() > entry.expiresAt) {
            otpStore.delete(cleanEmail);
            res.status(400).json({
                success: false,
                message: 'Kode OTP telah kedaluwarsa. Silakan minta kode OTP baru.',
            });
            return;
        }
        if (entry.code !== otp.trim()) {
            res.status(400).json({
                success: false,
                message: 'Kode OTP salah. Periksa kembali kode yang Anda terima.',
            });
            return;
        }
        const regData = entry.data || {};
        const regName = (name || regData.name || 'Pengguna').trim();
        const regPass = password || regData.password;
        const regPhone = phone || regData.phone;
        if (!regPass) {
            res.status(400).json({ success: false, message: 'Data pendaftaran tidak lengkap. Ulangi pendaftaran.' });
            return;
        }
        const [existing] = await database_1.default.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
        if (existing && existing.length > 0) {
            otpStore.delete(cleanEmail);
            res.status(409).json({ success: false, message: 'Email sudah terdaftar. Silakan langsung login.' });
            return;
        }
        const passwordHash = await bcrypt_1.default.hash(regPass, 10);
        const regUsername = (req.body.username || regData.username || '').trim().toLowerCase() || null;
        const [result] = await database_1.default.query('INSERT INTO users (name, username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, "pengunjung", 1)', [regName, regUsername, cleanEmail, passwordHash]);
        const newUserId = result.insertId;
        if (regPhone && regPhone.trim()) {
            await database_1.default.query('INSERT INTO user_addresses (user_id, recipient_name, phone, full_address, is_default) VALUES (?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE phone = VALUES(phone)', [newUserId, regName, regPhone.trim(), 'Belum ada alamat lengkap']).catch(() => { });
        }
        otpStore.delete(cleanEmail);
        const { token, refresh_token } = signTokenPair({ id: newUserId, email: cleanEmail, role: 'pengunjung' });
        res.status(201).json({
            success: true,
            message: 'Pendaftaran pengunjung berhasil terverifikasi!',
            data: {
                token,
                refresh_token,
                id: newUserId,
                name: regName,
                email: cleanEmail,
                role: 'pengunjung',
            },
            meta: { timestamp: new Date().toISOString() }
        });
        return;
    }
    catch (error) {
        console.error('Error verifyRegisterOtp:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat verifikasi OTP.' });
    }
};
exports.verifyRegisterOtp = verifyRegisterOtp;
// ============================================================
// RESEND OTP REGISTRASI MANUAL PENGUNJUNG
// ============================================================
const resendRegisterOtp = async (req, res) => {
    try {
        const { email, name } = req.body;
        if (!email) {
            res.status(400).json({ success: false, message: 'Email wajib diisi' });
            return;
        }
        const cleanEmail = email.trim().toLowerCase();
        const entry = otpStore.get(cleanEmail);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000;
        otpStore.set(cleanEmail, {
            code: otp,
            email: cleanEmail,
            expiresAt,
            verified: false,
            type: 'register',
            data: entry?.data,
        });
        console.log('\n========================================');
        console.log(`[DEV RESEND REGISTER OTP] Kode OTP untuk ${cleanEmail}: ${otp}`);
        console.log('========================================\n');
        try {
            await (0, emailService_js_1.sendOTPEmail)(cleanEmail, otp, name || entry?.data?.name || 'Pengguna');
            console.log(`✅ [OTP EMAIL] Email OTP resend berhasil terkirim ke ${cleanEmail}`);
        }
        catch (err) {
            console.error('⚠️ [OTP EMAIL] Gagal kirim ulang OTP email:', err.message);
        }
        res.status(200).json({
            success: true,
            message: 'Kode OTP baru telah dikirim ke email Anda.',
            data: {
                email: cleanEmail,
            },
            meta: { timestamp: new Date().toISOString() }
        });
    }
    catch (error) {
        console.error('Error resendRegisterOtp:', error);
        res.status(500).json({ success: false, message: 'Gagal mengirim ulang kode OTP.' });
    }
};
exports.resendRegisterOtp = resendRegisterOtp;
// ============================================================
// Cek Ketersediaan Username
// ============================================================
const checkUsername = async (req, res) => {
    try {
        const rawUsername = (req.query['username'] || req.body['username'] || '').toString();
        const username = rawUsername.trim().toLowerCase();
        if (!username) {
            res.status(200).json({
                success: true,
                available: false,
                message: 'Username wajib diisi',
            });
            return;
        }
        if (username.length < 3) {
            res.status(200).json({
                success: true,
                available: false,
                message: 'Username minimal 3 karakter',
            });
            return;
        }
        if (username.length > 30) {
            res.status(200).json({
                success: true,
                available: false,
                message: 'Username maksimal 30 karakter',
            });
            return;
        }
        const regex = /^[a-zA-Z0-9_]+$/;
        if (!regex.test(username)) {
            res.status(200).json({
                success: true,
                available: false,
                message: 'Username hanya boleh huruf, angka, dan underscore (_)',
            });
            return;
        }
        const [rows] = await database_1.default.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
        const isAvailable = !rows || rows.length === 0;
        res.status(200).json({
            success: true,
            available: isAvailable,
            username,
            message: isAvailable ? 'Username tersedia' : 'Username sudah digunakan',
            meta: { timestamp: new Date().toISOString() },
        });
    }
    catch (error) {
        console.error('Error checkUsername:', error);
        res.status(500).json({
            success: false,
            available: false,
            message: 'Gagal memeriksa ketersediaan username.',
        });
    }
};
exports.checkUsername = checkUsername;
// ============================================================
// REFRESH TOKEN — Perpanjang sesi dengan refresh token
// Body: { refresh_token: string }
// ============================================================
const refreshToken = async (req, res) => {
    try {
        const { refresh_token } = req.body;
        if (!refresh_token || typeof refresh_token !== 'string') {
            res.status(400).json({ success: false, message: 'Refresh token wajib dikirim' });
            return;
        }
        const refreshSecret = process.env['JWT_REFRESH_SECRET'] || process.env['JWT_SECRET'];
        if (!refreshSecret) {
            res.status(500).json({ success: false, message: 'Konfigurasi server tidak lengkap' });
            return;
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(refresh_token, refreshSecret);
        }
        catch (err) {
            res.status(401).json({ success: false, message: 'Refresh token tidak valid atau kedaluwarsa. Silakan login ulang.' });
            return;
        }
        if (decoded.type !== 'refresh') {
            res.status(401).json({ success: false, message: 'Token bukan refresh token. Silakan login ulang.' });
            return;
        }
        // Pastikan user masih aktif & versi token masih berlaku (tidak di-kick)
        const [users] = await database_1.default.query('SELECT id, email, role, is_active, token_version FROM users WHERE id = ? LIMIT 1', [decoded.userId]);
        if (!users || users.length === 0) {
            res.status(401).json({ success: false, message: 'Pengguna tidak ditemukan. Silakan login ulang.' });
            return;
        }
        const user = users[0];
        if (user.is_active === 0) {
            res.status(403).json({ success: false, message: 'Akun Anda sedang dinonaktifkan.' });
            return;
        }
        if ((decoded.ver ?? 0) !== user.token_version) {
            res.status(401).json({ success: false, message: 'Sesi Anda telah diakhiri dari perangkat lain. Silakan login ulang.' });
            return;
        }
        const { token, refresh_token: newRefreshToken } = signTokenPair({ id: user.id, email: user.email, role: user.role, ver: user.token_version });
        res.status(200).json({
            success: true,
            message: 'Token berhasil diperbarui.',
            data: {
                token,
                refresh_token: newRefreshToken,
                id: user.id,
                email: user.email,
                role: user.role,
            },
            meta: { timestamp: new Date().toISOString() }
        });
        return;
    }
    catch (error) {
        console.error('Error refresh token:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
        return;
    }
};
exports.refreshToken = refreshToken;
//# sourceMappingURL=authController.js.map