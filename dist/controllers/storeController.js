"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStoreProfile = void 0;
const database_js_1 = __importDefault(require("../config/database.js"));
const getStoreProfile = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        if (!userId) {
            res.status(401).json({ success: false, message: 'Autentikasi gagal. User tidak ditemukan.' });
            return;
        }
        // 1. Ambil profil toko beserta banner dan avatar (gabung dengan users untuk fallback avatar & nama)
        const [storeRows] = await database_js_1.default.query(`SELECT 
        m.id,
        m.user_id,
        m.store_name,
        m.workshop_address,
        m.description,
        COALESCE(m.avatar_url, u.avatar_url) AS avatar_url,
        m.banner_url,
        u.name AS owner_name
      FROM mitra_profiles m
      LEFT JOIN users u ON m.user_id = u.id
      WHERE m.user_id = ?
      LIMIT 1`, [userId]);
        if (!storeRows || storeRows.length === 0) {
            res.status(404).json({ success: false, message: 'Toko belum dikonfigurasi' });
            return;
        }
        const store = storeRows[0];
        // Format avatar_url & banner_url jika relative path
        let avatarUrl = store.avatar_url || null;
        if (avatarUrl && !avatarUrl.startsWith('http')) {
            avatarUrl = `http://localhost:5000${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
        }
        let bannerUrl = store.banner_url || null;
        if (bannerUrl && !bannerUrl.startsWith('http')) {
            bannerUrl = `http://localhost:5000${bannerUrl.startsWith('/') ? '' : '/'}${bannerUrl}`;
        }
        // 2. Ambil semua produk milik toko ini
        const [productRows] = await database_js_1.default.query(`SELECT 
        id,
        name,
        price,
        image_urls,
        created_at
      FROM products
      WHERE mitra_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
      ORDER BY created_at DESC`, [store.id]);
        const products = productRows.map((p) => {
            let imageUrl = null;
            if (p.image_urls) {
                try {
                    const parsed = typeof p.image_urls === 'string' ? JSON.parse(p.image_urls) : p.image_urls;
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        imageUrl = parsed[0];
                    }
                    else if (typeof parsed === 'string') {
                        imageUrl = parsed;
                    }
                }
                catch {
                    imageUrl = String(p.image_urls);
                }
            }
            if (imageUrl && !imageUrl.startsWith('http')) {
                imageUrl = `http://localhost:5000${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
            }
            return {
                id: p.id,
                name: p.name,
                price: Number(p.price),
                imageUrl: imageUrl,
                isHot: true,
                rating: 4.9,
            };
        });
        res.status(200).json({
            success: true,
            data: {
                store: {
                    name: store.store_name || store.owner_name || 'Toko Mitra',
                    address: store.workshop_address || 'Alamat belum diatur',
                    description: store.description || 'Belum ada deskripsi toko.',
                    avatarUrl: avatarUrl,
                    bannerUrl: bannerUrl,
                    rating: 4.9,
                    reviewCount: 128,
                },
                products: products,
            },
        });
    }
    catch (error) {
        console.error('Error fetching store profile:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
    }
};
exports.getStoreProfile = getStoreProfile;
//# sourceMappingURL=storeController.js.map