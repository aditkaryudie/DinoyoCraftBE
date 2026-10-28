"use strict";
// ============================================================
//  src/controllers/cartController.ts
//  Controller Keranjang Belanja Pelanggan
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearCart = exports.deleteCartItem = exports.updateCartItem = exports.addToCart = exports.getCart = void 0;
const database_js_1 = __importDefault(require("../config/database.js"));
const response_js_1 = require("../utils/response.js");
const getCart = async (_req, res) => {
    try {
        const userId = res.locals['userId'];
        const [items] = await database_js_1.default.query(`SELECT 
         c.id,
         c.product_id,
         c.quantity,
         c.variant,
         c.created_at,
         p.name AS product_name,
         p.price AS product_price,
         p.stock AS product_stock,
         p.weight_gram,
         p.image_urls,
         m.id AS mitra_id,
         m.store_name,
         m.workshop_address
       FROM carts c
       JOIN products p ON c.product_id = p.id
       JOIN mitra_profiles m ON p.mitra_id = m.id
       WHERE c.user_id = ? AND p.is_deleted = 0
       ORDER BY c.id DESC`, [userId]);
        // Format foto produk jika JSON string
        const formattedItems = items.map((item) => {
            let images = [];
            if (typeof item.image_urls === 'string') {
                try {
                    images = JSON.parse(item.image_urls);
                }
                catch {
                    images = [];
                }
            }
            else if (Array.isArray(item.image_urls)) {
                images = item.image_urls;
            }
            return {
                ...item,
                image_urls: images,
                subtotal: Number(item.product_price) * item.quantity,
            };
        });
        const totalQuantity = formattedItems.reduce((acc, item) => acc + item.quantity, 0);
        const totalPrice = formattedItems.reduce((acc, item) => acc + item.subtotal, 0);
        (0, response_js_1.sendSuccess)(res, {
            items: formattedItems,
            totalQuantity,
            totalPrice,
        }, 'Data keranjang berhasil diambil.');
    }
    catch (error) {
        console.error('❌ [getCart] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal mengambil data keranjang belanja.');
    }
};
exports.getCart = getCart;
const addToCart = async (req, res) => {
    try {
        const userId = res.locals['userId'];
        const { product_id, quantity = 1, variant = null } = req.body;
        // 1. Cek apakah produk tersedia dan aktif
        const [products] = await database_js_1.default.query('SELECT id, name, price, stock, is_deleted FROM products WHERE id = ?', [product_id]);
        if (products.length === 0 || products[0].is_deleted) {
            (0, response_js_1.sendNotFound)(res, 'Produk tidak ditemukan atau sudah tidak tersedia.');
            return;
        }
        const product = products[0];
        // 2. Cek apakah produk dan varian yang sama sudah ada di keranjang
        const [existingCart] = await database_js_1.default.query('SELECT id, quantity FROM carts WHERE user_id = ? AND product_id = ? AND (variant = ? OR (variant IS NULL AND ? IS NULL))', [userId, product_id, variant, variant]);
        if (existingCart.length > 0) {
            const newQuantity = existingCart[0].quantity + quantity;
            if (newQuantity > product.stock) {
                (0, response_js_1.sendBadRequest)(res, `Stok produk tidak mencukupi (tersisa ${product.stock}).`);
                return;
            }
            await database_js_1.default.query('UPDATE carts SET quantity = ? WHERE id = ?', [newQuantity, existingCart[0].id]);
            const [updated] = await database_js_1.default.query('SELECT * FROM carts WHERE id = ?', [existingCart[0].id]);
            (0, response_js_1.sendSuccess)(res, updated[0], 'Jumlah produk di keranjang berhasil diperbarui.');
            return;
        }
        // 3. Tambah baru ke keranjang
        if (quantity > product.stock) {
            (0, response_js_1.sendBadRequest)(res, `Stok produk tidak mencukupi (tersisa ${product.stock}).`);
            return;
        }
        const [result] = await database_js_1.default.query('INSERT INTO carts (user_id, product_id, quantity, variant) VALUES (?, ?, ?, ?)', [userId, product_id, quantity, variant]);
        const [newItem] = await database_js_1.default.query('SELECT * FROM carts WHERE id = ?', [result.insertId]);
        (0, response_js_1.sendCreated)(res, newItem[0], 'Produk berhasil ditambahkan ke keranjang.');
    }
    catch (error) {
        console.error('❌ [addToCart] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal menambahkan produk ke keranjang.');
    }
};
exports.addToCart = addToCart;
const updateCartItem = async (req, res) => {
    try {
        const userId = res.locals['userId'];
        const { id } = req.params;
        const { quantity, variant } = req.body;
        const [cartItem] = await database_js_1.default.query(`SELECT c.id, c.product_id, c.quantity, p.stock 
       FROM carts c
       JOIN products p ON c.product_id = p.id
       WHERE c.id = ? AND c.user_id = ?`, [id, userId]);
        if (cartItem.length === 0) {
            (0, response_js_1.sendNotFound)(res, 'Item keranjang tidak ditemukan.');
            return;
        }
        if (quantity !== undefined && quantity > cartItem[0].stock) {
            (0, response_js_1.sendBadRequest)(res, `Stok produk tidak mencukupi (tersisa ${cartItem[0].stock}).`);
            return;
        }
        await database_js_1.default.query(`UPDATE carts SET 
         quantity = COALESCE(?, quantity),
         variant = COALESCE(?, variant)
       WHERE id = ? AND user_id = ?`, [quantity, variant, id, userId]);
        const [updated] = await database_js_1.default.query('SELECT * FROM carts WHERE id = ?', [id]);
        (0, response_js_1.sendSuccess)(res, updated[0], 'Item keranjang berhasil diperbarui.');
    }
    catch (error) {
        console.error('❌ [updateCartItem] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal memperbarui item keranjang.');
    }
};
exports.updateCartItem = updateCartItem;
const deleteCartItem = async (req, res) => {
    try {
        const userId = res.locals['userId'];
        const { id } = req.params;
        const [result] = await database_js_1.default.query('DELETE FROM carts WHERE id = ? AND user_id = ?', [id, userId]);
        if (result.affectedRows === 0) {
            (0, response_js_1.sendNotFound)(res, 'Item keranjang tidak ditemukan.');
            return;
        }
        (0, response_js_1.sendSuccess)(res, null, 'Item berhasil dihapus dari keranjang.');
    }
    catch (error) {
        console.error('❌ [deleteCartItem] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal menghapus item dari keranjang.');
    }
};
exports.deleteCartItem = deleteCartItem;
const clearCart = async (_req, res) => {
    try {
        const userId = res.locals['userId'];
        await database_js_1.default.query('DELETE FROM carts WHERE user_id = ?', [userId]);
        (0, response_js_1.sendSuccess)(res, null, 'Keranjang belanja berhasil dikosongkan.');
    }
    catch (error) {
        console.error('❌ [clearCart] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal mengosongkan keranjang belanja.');
    }
};
exports.clearCart = clearCart;
//# sourceMappingURL=cartController.js.map