"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardMitra = void 0;
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
//# sourceMappingURL=mitraController.js.map