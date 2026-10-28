"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProduct = exports.getOrders = exports.getFinanceReport = exports.getDashboardMitra = void 0;
const database_js_1 = __importDefault(require("../config/database.js"));
const getDashboardMitra = async (req, res) => {
    try {
        // 1. Ambil ID user dari JWT (res.locals atau req.user)
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        if (!userId) {
            res.status(401).json({ success: false, message: 'Autentikasi gagal. User tidak ditemukan.' });
            return;
        }
        // 2. Cari profil mitra berdasarkan user_id
        const [mitraRows] = await database_js_1.default.query('SELECT id, user_id, store_name FROM mitra_profiles WHERE user_id = ? LIMIT 1', [userId]);
        const [userRows] = await database_js_1.default.query('SELECT id, name FROM users WHERE id = ? LIMIT 1', [userId]);
        const userName = userRows && userRows.length > 0 ? userRows[0].name : 'Mitra';
        const mitra = mitraRows && mitraRows.length > 0 ? mitraRows[0] : null;
        const mitraId = mitra ? mitra.id : null;
        const storeName = mitra?.store_name || userName;
        // 3. Hitung Produk Aktif dari tabel products
        let totalProducts = 0;
        if (mitraId) {
            const [productCountRows] = await database_js_1.default.query('SELECT COUNT(*) AS total FROM products WHERE mitra_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)', [mitraId]);
            totalProducts = Number(productCountRows[0]?.total || 0);
        }
        // 4. Hitung Pesanan dan Saldo dari tabel orders
        let totalOrders = 0;
        let activeBalance = 0;
        let recentOrdersFormatted = [];
        if (mitraId) {
            // Hitung total pesanan
            const [orderCountRows] = await database_js_1.default.query('SELECT COUNT(*) AS total FROM orders WHERE mitra_id = ?', [mitraId]);
            totalOrders = Number(orderCountRows[0]?.total || 0);
            // Hitung Saldo Aktif dari total pesanan yang tidak dibatalkan
            const [balanceRows] = await database_js_1.default.query("SELECT COALESCE(SUM(total_amount), 0) AS balance FROM orders WHERE mitra_id = ? AND (status IS NULL OR status != 'cancelled')", [mitraId]);
            activeBalance = Number(balanceRows[0]?.balance || 0);
            // Query pesanan terbaru
            const [orderRows] = await database_js_1.default.query(`SELECT 
          o.id,
          o.created_at,
          o.status,
          COALESCE(u.name, 'Pembeli') AS customer_name,
          COALESCE((SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id), 1) AS total_items
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.mitra_id = ?
        ORDER BY o.created_at DESC
        LIMIT 5`, [mitraId]);
            const statusMap = {
                pending: 'Menunggu Pembayaran',
                paid: 'Perlu Diproses',
                packed: 'Sedang Dikemas',
                shipped: 'Sedang Dikirim',
                completed: 'Selesai',
                cancelled: 'Dibatalkan'
            };
            recentOrdersFormatted = orderRows.map((item) => {
                const orderDate = item.created_at ? new Date(item.created_at) : new Date();
                const dateStr = orderDate.toISOString().split('T')[0].replace(/-/g, '');
                return {
                    id: `ORD-${dateStr}-00${item.id}`,
                    items: Number(item.total_items || 1),
                    customer: item.customer_name,
                    status: statusMap[item.status] || item.status || 'Perlu Diproses'
                };
            });
        }
        // 5. Susun respons JSON yang siap di-consume frontend
        res.status(200).json({
            success: true,
            data: {
                mitraName: storeName,
                stats: {
                    totalPesanan: totalOrders,
                    produkAktif: totalProducts,
                    saldoAktif: activeBalance,
                    kunjunganProfil: 342
                },
                recentOrders: recentOrdersFormatted
            }
        });
    }
    catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server' });
    }
};
exports.getDashboardMitra = getDashboardMitra;
// --- 1. ENDPOINT LAPORAN KEUANGAN ---
const getFinanceReport = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        if (!userId) {
            res.status(401).json({ success: false, message: 'Autentikasi gagal. User tidak ditemukan.' });
            return;
        }
        const [mitraRows] = await database_js_1.default.query('SELECT id, user_id, store_name FROM mitra_profiles WHERE user_id = ? LIMIT 1', [userId]);
        const mitra = mitraRows && mitraRows.length > 0 ? mitraRows[0] : null;
        if (!mitra) {
            res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });
            return;
        }
        const mitraId = mitra.id;
        // Ambil order untuk kalkulasi saldo
        const [orders] = await database_js_1.default.query('SELECT id, total_amount, status, created_at FROM orders WHERE mitra_id = ?', [mitraId]);
        let saldoAktif = 0;
        let pendapatanTertunda = 0;
        orders.forEach((order) => {
            const total = Number(order.total_amount || 0);
            const status = (order.status || '').toLowerCase();
            if (status === 'completed' || status === 'delivered' || status === 'selesai') {
                saldoAktif += total;
            }
            else if (['pending', 'paid', 'packed', 'shipped', 'processing'].includes(status)) {
                pendapatanTertunda += total;
            }
        });
        // Ambil riwayat pesanan/transaksi terbaru untuk mitra ini
        const [recentOrderRows] = await database_js_1.default.query(`SELECT id, created_at, total_amount, status 
       FROM orders 
       WHERE mitra_id = ? 
       ORDER BY created_at DESC 
       LIMIT 10`, [mitraId]);
        let riwayatTransaksi = recentOrderRows.map((o) => {
            const d = o.created_at ? new Date(o.created_at) : new Date();
            const tanggal = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            const statusStr = (o.status || '').toLowerCase();
            const statusLabel = (statusStr === 'completed' || statusStr === 'selesai' || statusStr === 'delivered')
                ? 'Selesai'
                : (statusStr === 'cancelled' ? 'Dibatalkan' : 'Tertunda');
            return {
                id: `TRX-${String(o.id).padStart(3, '0')}`,
                tanggal,
                deskripsi: `Penjualan - INV/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/00${o.id}`,
                status: statusLabel,
                nominal: Number(o.total_amount || 0)
            };
        });
        res.json({
            success: true,
            data: {
                saldoAktif,
                pendapatanTertunda,
                totalDitarik: 0,
                riwayatTransaksi
            }
        });
    }
    catch (error) {
        console.error('Error finance report:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getFinanceReport = getFinanceReport;
// --- 2. ENDPOINT MANAJEMEN PESANAN ---
const getOrders = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        if (!userId) {
            res.status(401).json({ success: false, message: 'Autentikasi gagal. User tidak ditemukan.' });
            return;
        }
        const [mitraRows] = await database_js_1.default.query('SELECT id FROM mitra_profiles WHERE user_id = ? LIMIT 1', [userId]);
        const mitra = mitraRows && mitraRows.length > 0 ? mitraRows[0] : null;
        if (!mitra) {
            res.status(404).json({ success: false, message: 'Mitra tidak ditemukan' });
            return;
        }
        const mitraId = mitra.id;
        // Cari pesanan milik mitra ini
        const [orderRows] = await database_js_1.default.query(`SELECT 
        o.id,
        o.created_at,
        o.status,
        o.total_amount,
        COALESCE(u.name, 'Customer') AS customer_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.mitra_id = ?
      ORDER BY o.created_at DESC`, [mitraId]);
        if (orderRows.length === 0) {
            res.json({ success: true, data: [] });
            return;
        }
        const orderIds = orderRows.map((o) => o.id);
        const placeholders = orderIds.map(() => '?').join(',');
        // Ambil order items untuk pesanan-pesanan ini
        const [itemRows] = await database_js_1.default.query(`SELECT 
        oi.order_id,
        oi.quantity,
        oi.unit_price,
        p.name AS product_name,
        p.image_urls
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id IN (${placeholders})`, orderIds);
        // Group items by order_id
        const itemsByOrder = {};
        for (const item of itemRows) {
            if (!itemsByOrder[item.order_id]) {
                itemsByOrder[item.order_id] = [];
            }
            itemsByOrder[item.order_id].push({
                productName: item.product_name,
                quantity: item.quantity,
                price: Number(item.unit_price)
            });
        }
        // Format respons
        const formattedOrders = orderRows.map((order) => {
            const orderDate = order.created_at ? new Date(order.created_at) : new Date();
            const dateStr = orderDate.toISOString().split('T')[0].replace(/-/g, '');
            return {
                orderId: `ORD-${dateStr}-00${order.id}`,
                tanggal: order.created_at,
                customerName: order.customer_name || 'Customer',
                status: order.status,
                totalBelanja: Number(order.total_amount || 0),
                items: itemsByOrder[order.id] || []
            };
        });
        res.json({ success: true, data: formattedOrders });
    }
    catch (error) {
        console.error('Error get orders:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getOrders = getOrders;
// --- 3. ENDPOINT EDIT PRODUK (FIX KATALOG BUG) ---
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params; // ID produk dari URL
        const { name, title, price, stock, category_id, description } = req.body;
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        if (!userId) {
            res.status(401).json({ success: false, message: 'Autentikasi gagal. User tidak ditemukan.' });
            return;
        }
        const [mitraRows] = await database_js_1.default.query('SELECT id FROM mitra_profiles WHERE user_id = ? LIMIT 1', [userId]);
        const mitra = mitraRows && mitraRows.length > 0 ? mitraRows[0] : null;
        if (!mitra) {
            res.status(404).json({ success: false, message: 'Profil mitra tidak ditemukan' });
            return;
        }
        const mitraId = mitra.id;
        // Pastikan produk yang diedit benar-benar milik mitra yang sedang login
        const [prodRows] = await database_js_1.default.query('SELECT * FROM products WHERE id = ? AND mitra_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) LIMIT 1', [id, mitraId]);
        if (!prodRows || prodRows.length === 0) {
            res.status(404).json({ success: false, message: 'Produk tidak ditemukan atau Anda tidak memiliki akses' });
            return;
        }
        const existingProduct = prodRows[0];
        // Dapatkan data update (dukung 'name' atau 'title')
        const updatedName = name !== undefined ? name : (title !== undefined ? title : existingProduct.name);
        const updatedPrice = price !== undefined ? parseFloat(price) : existingProduct.price;
        const updatedStock = stock !== undefined ? parseInt(stock) : existingProduct.stock;
        const updatedDesc = description !== undefined ? description : existingProduct.description;
        let updatedCategoryId = existingProduct.category_id;
        if (category_id !== undefined) {
            const parsedCat = parseInt(category_id);
            if (!isNaN(parsedCat)) {
                updatedCategoryId = parsedCat;
            }
            else {
                const [catRows] = await database_js_1.default.query('SELECT id FROM categories WHERE name = ? LIMIT 1', [category_id]);
                if (catRows && catRows.length > 0) {
                    updatedCategoryId = catRows[0].id;
                }
            }
        }
        // Lakukan update ke database
        await database_js_1.default.query(`UPDATE products 
       SET name = ?, description = ?, price = ?, stock = ?, category_id = ?, updated_at = NOW() 
       WHERE id = ? AND mitra_id = ?`, [updatedName, updatedDesc, updatedPrice, updatedStock, updatedCategoryId, id, mitraId]);
        const [updatedRows] = await database_js_1.default.query('SELECT * FROM products WHERE id = ? LIMIT 1', [id]);
        res.json({
            success: true,
            message: 'Produk berhasil diperbarui!',
            data: updatedRows && updatedRows.length > 0 ? updatedRows[0] : existingProduct
        });
    }
    catch (error) {
        console.error('Error update product:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.updateProduct = updateProduct;
//# sourceMappingURL=mitraController.js.map