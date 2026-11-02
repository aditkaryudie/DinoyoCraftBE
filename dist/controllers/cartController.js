"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearCart = exports.removeCartItem = exports.updateCartItem = exports.addToCart = exports.getCart = void 0;
const database_js_1 = __importDefault(require("../config/database.js"));
const getCart = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const query = `
      SELECT 
        c.id,
        c.user_id,
        c.product_id,
        c.quantity,
        c.created_at,
        c.updated_at,
        p.name AS product_name,
        p.price AS product_price,
        p.stock AS product_stock,
        p.image_urls,
        p.mitra_id,
        m.store_name
      FROM carts c
      JOIN products p ON c.product_id = p.id
      LEFT JOIN mitra_profiles m ON p.mitra_id = m.id
      WHERE c.user_id = ? AND (p.is_deleted = 0 OR p.is_deleted IS NULL)
      ORDER BY c.id DESC
    `;
        const [rows] = await database_js_1.default.query(query, [userId]);
        let subtotal = 0;
        const items = rows.map((r) => {
            let image = '';
            if (r.image_urls) {
                try {
                    const parsed = typeof r.image_urls === 'string' ? JSON.parse(r.image_urls) : r.image_urls;
                    image = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : '';
                }
                catch {
                    image = String(r.image_urls);
                }
            }
            const price = Number(r.product_price);
            const qty = Number(r.quantity);
            subtotal += price * qty;
            return {
                id: r.id,
                product_id: r.product_id,
                name: r.product_name,
                price,
                quantity: qty,
                stock: Number(r.product_stock),
                image,
                mitra_id: r.mitra_id,
                store_name: r.store_name || 'Toko Mitra',
            };
        });
        res.status(200).json({
            success: true,
            data: {
                items,
                total_items: items.length,
                subtotal
            }
        });
    }
    catch (error) {
        console.error('Error getCart:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil keranjang' });
    }
};
exports.getCart = getCart;
const addToCart = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        const { product_id, quantity = 1 } = req.body;
        if (!product_id) {
            res.status(400).json({ success: false, message: 'product_id wajib diisi' });
            return;
        }
        const qty = Math.max(1, parseInt(String(quantity), 10) || 1);
        const [existing] = await database_js_1.default.query('SELECT id, quantity FROM carts WHERE user_id = ? AND product_id = ? LIMIT 1', [userId, product_id]);
        if (existing && existing.length > 0) {
            const newQty = existing[0].quantity + qty;
            await database_js_1.default.query('UPDATE carts SET quantity = ?, updated_at = NOW() WHERE id = ?', [newQty, existing[0].id]);
            res.status(200).json({ success: true, message: 'Kuantitas produk di keranjang berhasil diperbarui' });
            return;
        }
        const [result] = await database_js_1.default.query('INSERT INTO carts (user_id, product_id, quantity, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())', [userId, product_id, qty]);
        res.status(201).json({
            success: true,
            message: 'Produk berhasil ditambahkan ke keranjang',
            cartId: result.insertId
        });
    }
    catch (error) {
        console.error('Error addToCart:', error);
        res.status(500).json({ success: false, message: 'Gagal menambahkan ke keranjang' });
    }
};
exports.addToCart = addToCart;
const updateCartItem = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        const { id } = req.params;
        const { quantity } = req.body;
        const qty = parseInt(String(quantity), 10);
        if (isNaN(qty) || qty <= 0) {
            await database_js_1.default.query('DELETE FROM carts WHERE id = ? AND user_id = ?', [id, userId]);
            res.status(200).json({ success: true, message: 'Item keranjang dihapus' });
            return;
        }
        const [result] = await database_js_1.default.query('UPDATE carts SET quantity = ?, updated_at = NOW() WHERE id = ? AND user_id = ?', [qty, id, userId]);
        if (result.affectedRows === 0) {
            res.status(404).json({ success: false, message: 'Item keranjang tidak ditemukan' });
            return;
        }
        res.status(200).json({ success: true, message: 'Keranjang berhasil diperbarui' });
    }
    catch (error) {
        console.error('Error updateCartItem:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui item keranjang' });
    }
};
exports.updateCartItem = updateCartItem;
const removeCartItem = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        const { id } = req.params;
        const [result] = await database_js_1.default.query('DELETE FROM carts WHERE id = ? AND user_id = ?', [id, userId]);
        if (result.affectedRows === 0) {
            res.status(404).json({ success: false, message: 'Item keranjang tidak ditemukan' });
            return;
        }
        res.status(200).json({ success: true, message: 'Item berhasil dihapus dari keranjang' });
    }
    catch (error) {
        console.error('Error removeCartItem:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus item keranjang' });
    }
};
exports.removeCartItem = removeCartItem;
const clearCart = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        await database_js_1.default.query('DELETE FROM carts WHERE user_id = ?', [userId]);
        res.status(200).json({ success: true, message: 'Keranjang berhasil dikosongkan' });
    }
    catch (error) {
        console.error('Error clearCart:', error);
        res.status(500).json({ success: false, message: 'Gagal mengosongkan keranjang' });
    }
};
exports.clearCart = clearCart;
//# sourceMappingURL=cartController.js.map