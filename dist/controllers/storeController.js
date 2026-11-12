"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStoreProfile = void 0;
const database_js_1 = __importDefault(require("../config/database.js"));
const productController_js_1 = require("./productController.js");
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
        CASE 
          WHEN m.avatar_url IS NOT NULL AND m.avatar_url != '' AND m.avatar_url NOT LIKE '%googleusercontent.com%' AND m.avatar_url NOT LIKE '%google.com%' THEN m.avatar_url
          WHEN u.avatar_url IS NOT NULL AND u.avatar_url != '' AND u.avatar_url NOT LIKE '%googleusercontent.com%' AND u.avatar_url NOT LIKE '%google.com%' THEN u.avatar_url
          ELSE NULL 
        END AS avatar_url,
        COALESCE(NULLIF(m.banner_url, ''), 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?q=80&w=1200&auto=format&fit=crop') AS banner_url,
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
        description,
        price,
        stock,
        weight_gram,
        variants,
        image_urls,
        rating,
        total_reviews,
        created_at
      FROM products
      WHERE mitra_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
      ORDER BY created_at DESC`, [store.id]);
        const products = productRows.map((p) => {
            const imageUrls = (0, productController_js_1.parseImageUrls)(p.image_urls);
            let imageUrl = imageUrls.length > 0 ? imageUrls[0] : null;
            if (imageUrl && !imageUrl.startsWith('http')) {
                imageUrl = `http://localhost:5000${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
            }
            const totalReviews = Number(p.total_reviews) || 0;
            const rating = totalReviews > 0 ? Number(p.rating) || 0 : 0;
            return {
                id: p.id,
                name: p.name,
                description: p.description || '',
                price: Number(p.price),
                stock: Number(p.stock),
                weight_gram: Number(p.weight_gram) || 500,
                variants: (0, productController_js_1.parseVariants)(p.variants),
                imageUrl,
                isHot: false,
                rating,
                total_reviews: totalReviews,
            };
        });
        const [revStats] = await database_js_1.default.query(`SELECT COALESCE(ROUND(AVG(r.rating), 1), 0) AS avg_rating, COUNT(*) AS total_reviews
       FROM reviews r
       JOIN products p ON r.product_id = p.id
       WHERE p.mitra_id = ?`, [store.id]);
        const storeTotalReviews = Number(revStats?.[0]?.total_reviews) || 0;
        const storeRating = storeTotalReviews > 0 ? Number(revStats?.[0]?.avg_rating) || 0 : 0;
        res.status(200).json({
            success: true,
            data: {
                store: {
                    name: store.store_name || store.owner_name || 'Toko Mitra',
                    address: store.workshop_address || 'Alamat belum diatur',
                    description: store.description || 'Belum ada deskripsi toko.',
                    avatarUrl: avatarUrl,
                    bannerUrl: bannerUrl,
                    rating: storeRating,
                    reviewCount: storeTotalReviews,
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