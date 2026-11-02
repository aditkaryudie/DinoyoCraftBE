"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderStatus = exports.getOrderDetail = exports.getOrders = exports.checkoutOrder = void 0;
const database_js_1 = __importDefault(require("../config/database.js"));
const notificationService_js_1 = require("../services/notificationService.js");
const checkoutOrder = async (req, res) => {
    const connection = await database_js_1.default.getConnection();
    try {
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { mitra_id, address_id, shipping_cost = 0, customer_notes, items // Array: [{ product_id, quantity, unit_price }]
         } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({ success: false, message: 'Item pesanan tidak boleh kosong' });
            return;
        }
        await connection.beginTransaction();
        // 1. Hitung total amount
        let itemsTotal = 0;
        for (const item of items) {
            itemsTotal += Number(item.unit_price) * Number(item.quantity);
        }
        const finalTotal = itemsTotal + Number(shipping_cost);
        // 2. Buat transaksi
        const refCode = `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const [txResult] = await connection.query(`INSERT INTO transactions (user_id, transaction_type, amount, status, reference_code, notes, created_at, updated_at)
       VALUES (?, 'order_payment', ?, 'pending', ?, ?, NOW(), NOW())`, [userId, finalTotal, refCode, customer_notes || 'Pembelian produk keramik']);
        const txId = txResult.insertId;
        // 3. Tentukan mitra_id jika belum diberikan
        let resolvedMitraId = mitra_id;
        if (!resolvedMitraId && items.length > 0) {
            const [prodRows] = await connection.query('SELECT mitra_id FROM products WHERE id = ?', [items[0].product_id]);
            resolvedMitraId = prodRows?.[0]?.mitra_id || 10;
        }
        // 4. Buat order
        const [orderResult] = await connection.query(`INSERT INTO orders (user_id, mitra_id, address_id, transaction_id, total_amount, shipping_cost, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`, [userId, resolvedMitraId, address_id || null, txId, finalTotal, Number(shipping_cost)]);
        const orderId = orderResult.insertId;
        // 5. Masukkan items ke order_items
        for (const item of items) {
            await connection.query(`INSERT INTO order_items (order_id, product_id, quantity, unit_price, created_at)
         VALUES (?, ?, ?, ?, NOW())`, [orderId, item.product_id, item.quantity, item.unit_price]);
            // Kurangi stok produk
            await connection.query('UPDATE products SET stock = GREATEST(0, stock - ?) WHERE id = ?', [item.quantity, item.product_id]);
        }
        // 6. Hapus item dari keranjang user
        await connection.query('DELETE FROM carts WHERE user_id = ?', [userId]);
        await connection.commit();
        // 7. Notifikasi via FCM ke user pembeli
        (0, notificationService_js_1.sendPushNotificationToUser)(userId, 'Pesanan Berhasil Dibuat! 🛒', `Pesanan #${orderId} telah dibuat. Silakan selesaikan pembayaran Anda.`, { type: 'order', order_id: String(orderId), ref_code: refCode }).catch(() => { });
        res.status(201).json({
            success: true,
            message: 'Checkout berhasil dibuat',
            data: {
                order_id: orderId,
                transaction_id: txId,
                reference_code: refCode,
                total_amount: finalTotal,
                status: 'pending'
            }
        });
    }
    catch (error) {
        await connection.rollback();
        console.error('Error checkoutOrder:', error);
        res.status(500).json({ success: false, message: 'Gagal melakukan checkout' });
    }
    finally {
        connection.release();
    }
};
exports.checkoutOrder = checkoutOrder;
const getOrders = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { status } = req.query;
        let query = `
      SELECT 
        o.id,
        o.user_id,
        o.mitra_id,
        o.address_id,
        o.transaction_id,
        o.total_amount,
        o.shipping_cost,
        o.status,
        o.tracking_number,
        o.created_at,
        o.updated_at,
        m.store_name,
        t.reference_code,
        t.status AS payment_status
      FROM orders o
      LEFT JOIN mitra_profiles m ON o.mitra_id = m.id
      LEFT JOIN transactions t ON o.transaction_id = t.id
      WHERE o.user_id = ?
    `;
        const params = [userId];
        if (status && status !== 'all') {
            query += ' AND o.status = ?';
            params.push(status);
        }
        query += ' ORDER BY o.id DESC';
        const [rows] = await database_js_1.default.query(query, params);
        // Ambil order_items untuk setiap order
        for (const order of rows) {
            const [items] = await database_js_1.default.query(`SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, p.name AS product_name, p.image_urls
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`, [order.id]);
            order.items = items.map((it) => {
                let img = '';
                if (it.image_urls) {
                    try {
                        const parsed = typeof it.image_urls === 'string' ? JSON.parse(it.image_urls) : it.image_urls;
                        img = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : '';
                    }
                    catch {
                        img = String(it.image_urls);
                    }
                }
                return {
                    ...it,
                    image: img,
                    price: Number(it.unit_price)
                };
            });
        }
        res.status(200).json({ success: true, data: rows });
    }
    catch (error) {
        console.error('Error getOrders:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil riwayat pesanan' });
    }
};
exports.getOrders = getOrders;
const getOrderDetail = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || res.locals['userId'];
        const { id } = req.params;
        const [rows] = await database_js_1.default.query(`SELECT 
        o.id,
        o.user_id,
        o.mitra_id,
        o.address_id,
        o.transaction_id,
        o.total_amount,
        o.shipping_cost,
        o.status,
        o.tracking_number,
        o.created_at,
        o.updated_at,
        m.store_name,
        m.workshop_address,
        m.whatsapp_number AS store_phone,
        t.reference_code,
        t.status AS payment_status,
        a.recipient_name,
        a.phone AS recipient_phone,
        a.full_address
      FROM orders o
      LEFT JOIN mitra_profiles m ON o.mitra_id = m.id
      LEFT JOIN transactions t ON o.transaction_id = t.id
      LEFT JOIN user_addresses a ON o.address_id = a.id
      WHERE o.id = ? AND (o.user_id = ? OR o.mitra_id IN (SELECT id FROM mitra_profiles WHERE user_id = ?))
      LIMIT 1`, [id, userId, userId]);
        if (!rows || rows.length === 0) {
            res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
            return;
        }
        const order = rows[0];
        const [items] = await database_js_1.default.query(`SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, p.name AS product_name, p.image_urls
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`, [id]);
        order.items = items.map((it) => {
            let img = '';
            if (it.image_urls) {
                try {
                    const parsed = typeof it.image_urls === 'string' ? JSON.parse(it.image_urls) : it.image_urls;
                    img = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : '';
                }
                catch {
                    img = String(it.image_urls);
                }
            }
            return {
                ...it,
                image: img,
                price: Number(it.unit_price)
            };
        });
        res.status(200).json({ success: true, data: order });
    }
    catch (error) {
        console.error('Error getOrderDetail:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil detail pesanan' });
    }
};
exports.getOrderDetail = getOrderDetail;
const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, tracking_number } = req.body;
        const [orders] = await database_js_1.default.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [id]);
        if (!orders || orders.length === 0) {
            res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
            return;
        }
        const order = orders[0];
        await database_js_1.default.query(`UPDATE orders 
       SET status = COALESCE(?, status), 
           tracking_number = COALESCE(?, tracking_number),
           updated_at = NOW() 
       WHERE id = ?`, [status ?? null, tracking_number ?? null, id]);
        // Kirim notifikasi push ke pemilik pesanan
        const newStatus = status || order.status;
        (0, notificationService_js_1.sendPushNotificationToUser)(order.user_id, 'Status Pesanan Diperbarui! 📦', `Pesanan #${order.id} telah diperbarui statusnya menjadi: ${newStatus}`, { type: 'order', order_id: String(order.id), status: newStatus }).catch(() => { });
        res.status(200).json({
            success: true,
            message: 'Status pesanan berhasil diperbarui',
            data: { order_id: Number(id), status: newStatus, tracking_number: tracking_number || order.tracking_number }
        });
    }
    catch (error) {
        console.error('Error updateOrderStatus:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui status pesanan' });
    }
};
exports.updateOrderStatus = updateOrderStatus;
//# sourceMappingURL=orderController.js.map