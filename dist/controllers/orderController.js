"use strict";
// ============================================================
//  src/controllers/orderController.ts
//  Controller Transaksi, Pesanan, & Manajemen Status Pesanan
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderDetail = exports.getOrders = exports.checkoutOrder = exports.getOrderTracking = exports.cancelOrderByCustomer = exports.confirmOrderCompleted = exports.updateOrderStatus = exports.getMitraOrders = exports.getOrderById = exports.getUserOrders = exports.checkout = void 0;
exports.recordOrderStatusHistory = recordOrderStatusHistory;
exports.computeOrderTotals = computeOrderTotals;
const database_js_1 = __importDefault(require("../config/database.js"));
const response_js_1 = require("../utils/response.js");
const pusher_js_1 = __importDefault(require("../utils/pusher.js"));
const notificationService_js_1 = require("../services/notificationService.js");
const productController_js_1 = require("./productController.js");
const midtransService_js_1 = require("../services/midtransService.js");
const paymentGatewayService_js_1 = require("../services/paymentGatewayService.js");
// ============================================================
// HELPER — catat riwayat status pesanan (timeline tracking)
// ============================================================
async function recordOrderStatusHistory(orderId, status, trackingNumber, note, conn) {
    const query = 'INSERT INTO order_status_history (order_id, status, tracking_number, note) VALUES (?, ?, ?, ?)';
    if (conn) {
        await conn.query(query, [orderId, status, trackingNumber || null, note || null]);
    }
    else {
        await database_js_1.default.query(query, [orderId, status, trackingNumber || null, note || null]);
    }
}
// ============================================================
// HELPER — total tagihan pembayar (satu angka untuk semua layar):
// barang + ongkir + biaya platform (Midtrans channel fee ditanggung platform)
// ============================================================
function computeOrderTotals(o) {
    const base = Math.round(Number(o.total_amount || 0));
    const storedFee = Math.round(Number(o.gateway_fee ?? 0));
    const platform = storedFee > 0 ? storedFee : (0, midtransService_js_1.platformFeeFor)(base);
    return { base, platform, channel: 0, total_due: base + platform };
}
const checkout = async (req, res) => {
    const connection = await database_js_1.default.getConnection();
    try {
        await connection.beginTransaction();
        const userId = res.locals['userId'];
        const { mitra_id, address_id, shipping_method = 'Reguler', shipping_cost = 0, customer_notes = null, payment_method = 'qris', items, } = req.body;
        // 1. Validasi Alamat
        const [addresses] = await connection.query('SELECT id, full_address, recipient_name, phone FROM user_addresses WHERE id = ? AND user_id = ?', [address_id, userId]);
        if (addresses.length === 0) {
            await connection.rollback();
            (0, response_js_1.sendBadRequest)(res, 'Alamat pengiriman tidak valid.');
            return;
        }
        // 2. Validasi Mitra
        const [mitras] = await connection.query('SELECT id, user_id, store_name FROM mitra_profiles WHERE id = ? AND is_active = 1', [mitra_id]);
        if (mitras.length === 0) {
            await connection.rollback();
            (0, response_js_1.sendBadRequest)(res, 'Toko mitra tidak valid atau sedang tidak aktif.');
            return;
        }
        // 3. Validasi Produk & Hitung Subtotal
        let totalItemsAmount = 0;
        const validatedItems = [];
        for (const item of items) {
            const [prodRows] = await connection.query('SELECT id, name, price, stock, variants, is_deleted FROM products WHERE id = ? FOR UPDATE', [item.product_id]);
            if (prodRows.length === 0 || prodRows[0].is_deleted) {
                await connection.rollback();
                (0, response_js_1.sendBadRequest)(res, `Produk dengan ID ${item.product_id} tidak ditemukan atau sudah dihapus.`);
                return;
            }
            const prod = prodRows[0];
            const availableStock = (0, productController_js_1.getVariantAvailableStock)(prod.variants, Number(prod.stock) || 0, item.variant);
            if (availableStock < item.quantity) {
                await connection.rollback();
                (0, response_js_1.sendBadRequest)(res, `Stok produk '${prod.name}' tidak mencukupi (tersedia: ${availableStock}, diminta: ${item.quantity}).`);
                return;
            }
            const unitPrice = Number(prod.price);
            totalItemsAmount += unitPrice * item.quantity;
            validatedItems.push({
                product_id: prod.id,
                name: prod.name,
                quantity: item.quantity,
                unit_price: unitPrice,
                variant: item.variant || null,
            });
        }
        const grandTotal = totalItemsAmount + Number(shipping_cost);
        // 4. Buat Kode Referensi Transaksi Unik
        const refCode = `TRX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        // 5. Simpan ke Tabel Transactions (gateway_fee & expiry_time tetap dihitung resmi di BE)
        const platformFee = (0, midtransService_js_1.platformFeeFor)(grandTotal);
        const createdAt = new Date();
        const deadline = (0, paymentGatewayService_js_1.computeOrderDeadline)(createdAt);
        const mysqlExpiry = (0, paymentGatewayService_js_1.toMysqlWibDatetime)(deadline);
        const [trxResult] = await connection.query(`INSERT INTO transactions (user_id, transaction_type, amount, gateway_fee, status, reference_code, notes, expiry_time)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`, [userId, payment_method, grandTotal, platformFee, refCode, customer_notes, mysqlExpiry]);
        const transactionId = trxResult.insertId;
        // 6. Simpan ke Tabel Orders
        const [orderResult] = await connection.query(`INSERT INTO orders (user_id, mitra_id, address_id, transaction_id, total_amount, shipping_cost, shipping_method, customer_notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`, [userId, mitra_id, address_id, transactionId, grandTotal, shipping_cost, shipping_method, customer_notes]);
        const orderId = orderResult.insertId;
        // 7. Simpan ke Tabel Order Items & Kurangi Stok Produk
        for (const item of validatedItems) {
            await connection.query(`INSERT INTO order_items (order_id, product_id, quantity, unit_price, variant)
         VALUES (?, ?, ?, ?, ?)`, [orderId, item.product_id, item.quantity, item.unit_price, item.variant]);
            await (0, productController_js_1.adjustProductStockAndVariant)(connection, item.product_id, -item.quantity, item.variant);
            // Hapus item dari keranjang user jika ada
            await connection.query('DELETE FROM carts WHERE user_id = ? AND product_id = ?', [userId, item.product_id]);
        }
        // 7b. Catat status awal untuk timeline tracking
        await recordOrderStatusHistory(orderId, 'pending', null, 'Pesanan dibuat, menunggu pembayaran', connection);
        // 8. Kirim Notifikasi Sistem ke Mitra & Pelanggan
        await connection.query(`INSERT INTO notifications (user_id, title, message, type, reference_id)
       VALUES (?, ?, ?, 'order', ?)`, [
            mitras[0].user_id,
            'Pesanan Baru Masuk!',
            `Toko Anda menerima pesanan baru #${orderId} sebesar Rp ${grandTotal.toLocaleString('id-ID')}.`,
            orderId,
        ]);
        await connection.query(`INSERT INTO notifications (user_id, title, message, type, reference_id)
       VALUES (?, ?, ?, 'order', ?)`, [
            userId,
            'Pesanan Berhasil Dibuat',
            `Pesanan #${orderId} di toko ${mitras[0].store_name} berhasil dibuat. Silakan selesaikan pembayaran.`,
            orderId,
        ]);
        await connection.commit();
        (0, response_js_1.sendCreated)(res, {
            order_id: orderId,
            reference_code: refCode,
            total_amount: grandTotal,
            platform_fee: platformFee,
            channel_fee: 0,
            total_due: grandTotal + platformFee,
            payment_method,
            status: 'pending',
            created_at: (0, paymentGatewayService_js_1.toIsoWibString)(createdAt),
            expiry_time: (0, paymentGatewayService_js_1.toIsoWibString)(deadline),
        }, 'Pesanan berhasil dibuat.');
    }
    catch (error) {
        await connection.rollback();
        console.error('❌ [checkout] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal memproses pesanan.');
    }
    finally {
        connection.release();
    }
};
exports.checkout = checkout;
const getUserOrders = async (req, res) => {
    try {
        const userId = res.locals['userId'];
        const { status } = req.query;
        let query = `
      SELECT 
        o.id,
        o.total_amount,
        o.shipping_cost,
        o.shipping_method,
        o.tracking_number,
        t.gateway_fee,
        o.customer_notes,
        o.status,
        o.created_at,
        m.id AS mitra_id,
        m.store_name,
        m.whatsapp_number AS mitra_phone,
        t.reference_code,
        t.transaction_type AS payment_method,
        t.status AS payment_status,
        t.expiry_time,
        t.paid_at
      FROM orders o
      JOIN mitra_profiles m ON o.mitra_id = m.id
      LEFT JOIN transactions t ON o.transaction_id = t.id
      WHERE o.user_id = ?
    `;
        const params = [userId];
        if (status) {
            query += ' AND o.status = ?';
            params.push(status);
        }
        query += ' ORDER BY o.id DESC';
        const [orders] = await database_js_1.default.query(query, params);
        // Ambil order items untuk masing-masing order
        for (const order of orders) {
            const [items] = await database_js_1.default.query(`SELECT 
           oi.id,
           oi.product_id,
           oi.quantity,
           oi.unit_price,
           oi.variant,
           p.name AS product_name,
           p.image_urls
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`, [order.id]);
            order.items = items.map((item) => {
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
                return { ...item, image_urls: images };
            });
        }
        // Normalisasi angka: mysql2 mengembalikan DECIMAL sebagai string —
        // kirim sebagai number agar klien mobile tidak salah parse.
        const normalized = orders.map((o) => {
            const totals = computeOrderTotals(o);
            const deadline = o.status === 'pending'
                ? (0, paymentGatewayService_js_1.toIsoWibString)((0, paymentGatewayService_js_1.computeOrderDeadline)(o.created_at, o.expiry_time))
                : (0, paymentGatewayService_js_1.toIsoWibString)(o.expiry_time);
            return {
                ...o,
                created_at: (0, paymentGatewayService_js_1.toIsoWibString)(o.created_at) ?? o.created_at,
                expiry_time: deadline,
                paid_at: (0, paymentGatewayService_js_1.toIsoWibString)(o.paid_at),
                total_amount: Number(o.total_amount ?? 0),
                shipping_cost: Number(o.shipping_cost ?? 0),
                platform_fee: totals.platform,
                channel_fee: totals.channel,
                total_due: totals.total_due,
                items: (o.items || []).map((it) => ({
                    ...it,
                    quantity: Number(it.quantity ?? 0),
                    unit_price: Number(it.unit_price ?? 0),
                })),
            };
        });
        (0, response_js_1.sendSuccess)(res, normalized, 'Daftar riwayat pesanan berhasil diambil.');
    }
    catch (error) {
        console.error('❌ [getUserOrders] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal mengambil riwayat pesanan.');
    }
};
exports.getUserOrders = getUserOrders;
const getOrderById = async (req, res) => {
    try {
        const userId = res.locals['userId'];
        const role = res.locals['role'];
        const { id } = req.params;
        const [orders] = await database_js_1.default.query(`SELECT 
         o.*,
         m.store_name,
         m.whatsapp_number AS mitra_phone,
         m.workshop_address,
         m.user_id AS mitra_user_id,
         a.recipient_name,
         a.phone AS recipient_phone,
         a.full_address,
         a.city,
         a.postal_code,
         t.reference_code,
         t.transaction_type AS payment_method,
         t.status AS payment_status,
         t.payment_token,
         t.inv_id,
         t.payment_url,
         t.qr_string,
         t.gateway_fee,
         t.expiry_time,
         t.paid_at
       FROM orders o
       JOIN mitra_profiles m ON o.mitra_id = m.id
       LEFT JOIN user_addresses a ON o.address_id = a.id
       LEFT JOIN transactions t ON o.transaction_id = t.id
       WHERE o.id = ?`, [id]);
        if (orders.length === 0) {
            (0, response_js_1.sendNotFound)(res, 'Pesanan tidak ditemukan.');
            return;
        }
        const order = orders[0];
        // Cek otorisasi: hanya pembeli, mitra pemilik toko, atau admin yang boleh melihat
        if (role !== 'admin' && order.user_id !== userId && order.mitra_user_id !== userId) {
            (0, response_js_1.sendForbidden)(res, 'Anda tidak memiliki hak untuk melihat pesanan ini.');
            return;
        }
        const [items] = await database_js_1.default.query(`SELECT 
         oi.*,
         p.name AS product_name,
         p.image_urls
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`, [id]);
        order.items = items.map((item) => {
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
            return { ...item, image_urls: images };
        });
        const deadline = order.status === 'pending'
            ? (0, paymentGatewayService_js_1.toIsoWibString)((0, paymentGatewayService_js_1.computeOrderDeadline)(order.created_at, order.expiry_time))
            : (0, paymentGatewayService_js_1.toIsoWibString)(order.expiry_time);
        order.created_at = (0, paymentGatewayService_js_1.toIsoWibString)(order.created_at) ?? order.created_at;
        order.expiry_time = deadline;
        order.paid_at = (0, paymentGatewayService_js_1.toIsoWibString)(order.paid_at);
        (0, response_js_1.sendSuccess)(res, order, 'Detail pesanan berhasil diambil.');
    }
    catch (error) {
        console.error('❌ [getOrderById] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal mengambil detail pesanan.');
    }
};
exports.getOrderById = getOrderById;
const getMitraOrders = async (req, res) => {
    try {
        const userId = res.locals['userId'];
        const { status } = req.query;
        const [mitraRows] = await database_js_1.default.query('SELECT id FROM mitra_profiles WHERE user_id = ?', [userId]);
        if (mitraRows.length === 0) {
            (0, response_js_1.sendForbidden)(res, 'Profil mitra tidak ditemukan.');
            return;
        }
        const mitraId = mitraRows[0].id;
        let query = `
      SELECT 
        o.id,
        o.total_amount,
        o.shipping_cost,
        o.shipping_method,
        o.tracking_number,
        o.customer_notes,
        o.status,
        o.created_at,
        u.name AS customer_name,
        u.email AS customer_email,
        a.recipient_name,
        a.phone AS recipient_phone,
        a.full_address,
        a.city,
        a.postal_code,
        t.reference_code,
        t.status AS payment_status
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN user_addresses a ON o.address_id = a.id
      LEFT JOIN transactions t ON o.transaction_id = t.id
      WHERE o.mitra_id = ?
    `;
        const params = [mitraId];
        if (status) {
            query += ' AND o.status = ?';
            params.push(status);
        }
        query += ' ORDER BY o.id DESC';
        const [orders] = await database_js_1.default.query(query, params);
        for (const order of orders) {
            const [items] = await database_js_1.default.query(`SELECT 
           oi.*,
           p.name AS product_name,
           p.image_urls
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`, [order.id]);
            order.items = items;
        }
        (0, response_js_1.sendSuccess)(res, orders, 'Daftar pesanan toko berhasil diambil.');
    }
    catch (error) {
        console.error('❌ [getMitraOrders] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal mengambil daftar pesanan toko.');
    }
};
exports.getMitraOrders = getMitraOrders;
const updateOrderStatus = async (req, res) => {
    const connection = await database_js_1.default.getConnection();
    try {
        await connection.beginTransaction();
        const userId = res.locals['userId'];
        const role = res.locals['role'];
        const { id } = req.params;
        const { status, tracking_number, shipping_method } = req.body;
        const [orders] = await connection.query(`SELECT o.*, m.user_id AS mitra_user_id 
       FROM orders o
       JOIN mitra_profiles m ON o.mitra_id = m.id
       WHERE o.id = ? FOR UPDATE`, [id]);
        if (orders.length === 0) {
            await connection.rollback();
            (0, response_js_1.sendNotFound)(res, 'Pesanan tidak ditemukan.');
            return;
        }
        const order = orders[0];
        const isMitraOrAdmin = role === 'admin' || order.mitra_user_id === userId;
        const isBuyerCompleting = order.user_id === userId && status === 'completed';
        // Mitra/Admin berhak mengelola alur pengiriman; Pembeli berhak mengonfirmasi 'completed' saat 'shipped'
        if (!isMitraOrAdmin && !isBuyerCompleting) {
            await connection.rollback();
            (0, response_js_1.sendForbidden)(res, 'Anda tidak berwenang mengubah status pesanan ini.');
            return;
        }
        if (order.status === status) {
            await connection.rollback();
            (0, response_js_1.sendSuccess)(res, {
                order_id: Number(id),
                status: order.status,
                tracking_number: order.tracking_number,
                shipping_method: order.shipping_method,
            }, 'Status pesanan sudah sesuai.');
            return;
        }
        // Validasi transisi status e-commerce
        if (order.status === 'cancelled' || order.status === 'completed') {
            await connection.rollback();
            (0, response_js_1.sendBadRequest)(res, `Pesanan berstatus "${order.status}" sudah final dan tidak dapat diubah.`);
            return;
        }
        if (order.status === 'pending' && ['packed', 'shipped', 'completed'].includes(status)) {
            await connection.rollback();
            (0, response_js_1.sendBadRequest)(res, 'Pesanan belum dibayar sehingga belum dapat dikemas, dikirim, atau diselesaikan.');
            return;
        }
        if (status === 'completed' && !['shipped', 'packed'].includes(order.status)) {
            await connection.rollback();
            (0, response_js_1.sendBadRequest)(res, 'Pesanan harus berstatus dikirim sebelum dapat ditandai selesai.');
            return;
        }
        // Jika pesanan dibatalkan (cancelled), kembalikan stok produk
        if (status === 'cancelled' && order.status !== 'cancelled') {
            const [items] = await connection.query('SELECT product_id, quantity, variant FROM order_items WHERE order_id = ?', [id]);
            for (const item of items) {
                await (0, productController_js_1.adjustProductStockAndVariant)(connection, item.product_id, item.quantity, item.variant);
            }
            if (order.transaction_id) {
                await connection.query("UPDATE transactions SET status = 'cancelled' WHERE id = ? AND status = 'pending'", [order.transaction_id]);
            }
        }
        const nextTracking = tracking_number ? String(tracking_number).trim() : null;
        const nextShippingMethod = shipping_method ? String(shipping_method).trim() : null;
        await connection.query(`UPDATE orders SET 
         status = ?,
         tracking_number = COALESCE(?, tracking_number),
         shipping_method = COALESCE(?, shipping_method)
       WHERE id = ?`, [status, nextTracking, nextShippingMethod, id]);
        // Kirim notifikasi status terbaru ke customer
        const finalResi = nextTracking || order.tracking_number || '-';
        const statusTitles = {
            paid: 'Pembayaran Berhasil',
            packed: 'Pesanan Sedang Dikemas',
            shipped: 'Pesanan Sedang Dikirim',
            completed: 'Pesanan Diterima & Selesai',
            cancelled: 'Pesanan Dibatalkan',
        };
        const statusMessages = {
            paid: `Pembayaran pesanan #${id} telah berhasil dikonfirmasi. Penjual akan segera memproses barang Anda.`,
            packed: `Pesanan #${id} sedang dikemas dengan rapi oleh pengrajin.`,
            shipped: finalResi !== '-'
                ? `Pesanan #${id} telah dikirim! No. Resi: ${finalResi}`
                : `Pesanan #${id} telah dikirim oleh pengrajin!`,
            completed: `Pesanan #${id} telah diterima dan selesai. Dana telah diteruskan ke penjual. Jangan lupa beri ulasan terbaik!`,
            cancelled: `Pesanan #${id} telah dibatalkan.`,
        };
        const notifTitle = statusTitles[status] || `Status Pesanan #${id}: ${status.toUpperCase()}`;
        if (statusMessages[status]) {
            await connection.query(`INSERT INTO notifications (user_id, title, message, type, reference_id)
         VALUES (?, ?, ?, 'order', ?)`, [order.user_id, notifTitle, statusMessages[status], id]);
        }
        // Saat selesai, beri notifikasi ke mitra bahwa dana sudah masuk Saldo Aktif
        const mitraNominal = Number(order.total_amount || 0).toLocaleString('id-ID');
        if (status === 'completed') {
            await connection.query(`INSERT INTO notifications (user_id, title, message, type, reference_id)
         VALUES (?, ?, ?, 'order', ?)`, [
                order.mitra_user_id,
                'Dana Masuk ke Saldo Aktif!',
                `Pesanan #${id} telah diterima pembeli. Dana sebesar Rp ${mitraNominal} kini masuk ke Saldo Aktif toko dan siap ditarik.`,
                id,
            ]);
        }
        // Catat ke timeline tracking (hanya jika status berubah)
        if (order.status !== status) {
            const notes = {
                paid: 'Pembayaran terverifikasi',
                packed: 'Penjual sedang mengemas pesanan',
                shipped: nextShippingMethod
                    ? `Paket diserahkan ke kurir (${nextShippingMethod})`
                    : 'Paket diserahkan ke kurir',
                completed: isBuyerCompleting
                    ? 'Pembeli mengonfirmasi pesanan diterima'
                    : 'Pesanan diterima dan selesai',
                cancelled: 'Pesanan dibatalkan',
            };
            await recordOrderStatusHistory(Number(id), status, nextTracking || order.tracking_number || null, notes[status] || null, connection);
        }
        await connection.commit();
        // Dorong update realtime ke HP customer & mitra (non-blocking).
        try {
            await pusher_js_1.default.trigger(`user-${order.user_id}`, 'order-status-changed', {
                order_id: Number(id),
                status,
                title: notifTitle,
                message: statusMessages[status] || '',
                tracking_number: nextTracking || order.tracking_number || null,
            });
            if (status === 'completed') {
                await pusher_js_1.default.trigger(`user-${order.mitra_user_id}`, 'order-completed', {
                    order_id: Number(id),
                    status: 'completed',
                    amount: Number(order.total_amount || 0),
                });
            }
        }
        catch { /* non-blocking */ }
        // Push FCM ke HP customer & mitra (non-blocking).
        if (statusMessages[status]) {
            void (0, notificationService_js_1.sendPushNotificationToUser)(order.user_id, notifTitle, statusMessages[status], { type: 'order', route: '/profile', order_id: String(id), status });
        }
        if (status === 'completed') {
            void (0, notificationService_js_1.sendPushNotificationToUser)(order.mitra_user_id, 'Dana Masuk ke Saldo Aktif!', `Pesanan #${id} selesai diterima pembeli. Rp ${mitraNominal} masuk ke Saldo Aktif.`, { type: 'order', route: '/mitra/dashboard/laporan-keuangan', order_id: String(id), status });
        }
        (0, response_js_1.sendSuccess)(res, {
            order_id: Number(id),
            status,
            tracking_number: nextTracking || order.tracking_number || null,
            shipping_method: nextShippingMethod || order.shipping_method || null,
        }, 'Status pesanan berhasil diperbarui.');
    }
    catch (error) {
        await connection.rollback().catch(() => { });
        console.error('❌ [updateOrderStatus] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal memperbarui status pesanan.');
    }
    finally {
        connection.release();
    }
};
exports.updateOrderStatus = updateOrderStatus;
// ============================================================
// POST /api/orders/:id/complete — Konfirmasi "Pesanan Diterima" oleh Pembeli
// Memindahkan pendapatan pesanan dari Pendapatan Tertunda -> Saldo Aktif Mitra
// ============================================================
const confirmOrderCompleted = async (req, res) => {
    req.body = { ...(req.body || {}), status: 'completed' };
    await (0, exports.updateOrderStatus)(req, res);
};
exports.confirmOrderCompleted = confirmOrderCompleted;
// Aliases
// ============================================================
// POST /api/orders/:id/cancel — Pembatalan oleh PEMILIK pesanan
// Hanya untuk pesanan 'pending' (belum bayar). Stok dikembalikan.
// ============================================================
const cancelOrderByCustomer = async (req, res) => {
    const connection = await database_js_1.default.getConnection();
    try {
        const userId = res.locals['userId'];
        const role = res.locals['role'];
        const { id } = req.params;
        const [orders] = await connection.query(`SELECT o.*, m.user_id AS mitra_user_id, t.gateway_order_id
       FROM orders o
       JOIN mitra_profiles m ON o.mitra_id = m.id
       LEFT JOIN transactions t ON o.transaction_id = t.id
       WHERE o.id = ?`, [id]);
        if (orders.length === 0) {
            (0, response_js_1.sendNotFound)(res, 'Pesanan tidak ditemukan.');
            return;
        }
        const order = orders[0];
        // Hanya pemilik pesanan (atau admin) yang boleh membatalkan.
        if (order.user_id !== userId && role !== 'admin') {
            (0, response_js_1.sendForbidden)(res, 'Hanya pemilik pesanan yang dapat membatalkannya.');
            return;
        }
        // Belum-bayar saja — pesanan yang sudah dibayar/diproses mengikuti alur mitra.
        if (order.status !== 'pending') {
            (0, response_js_1.sendBadRequest)(res, `Pesanan dengan status "${order.status}" tidak dapat dibatalkan langsung. Hubungi penjual bila diperlukan.`);
            return;
        }
        await connection.beginTransaction();
        // Kembalikan stok produk.
        const [items] = await connection.query('SELECT product_id, quantity, variant FROM order_items WHERE order_id = ?', [id]);
        for (const item of items) {
            await (0, productController_js_1.adjustProductStockAndVariant)(connection, item.product_id, item.quantity, item.variant);
        }
        await connection.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [id]);
        await connection.query("UPDATE transactions SET status = 'cancelled' WHERE id = ?", [
            order.transaction_id,
        ]);
        await recordOrderStatusHistory(Number(id), 'cancelled', null, 'Dibatalkan oleh pembeli', connection);
        await connection.query(`INSERT INTO notifications (user_id, title, message, type, reference_id)
       VALUES (?, ?, ?, 'order', ?)`, [
            order.mitra_user_id,
            'Pesanan Dibatalkan',
            `Pesanan #${id} dibatalkan oleh pembeli sebelum pembayaran.`,
            id,
        ]);
        await connection.commit();
        // Batalkan charge aktif di Midtrans Sandbox (best-effort agar VA/QR lama ikut invalid)
        await (0, paymentGatewayService_js_1.cancelRemoteChargeIfAny)(order.gateway_order_id);
        try {
            await pusher_js_1.default.trigger(`user-${order.mitra_user_id}`, 'order-status-changed', {
                order_id: Number(id),
                status: 'cancelled',
            });
        }
        catch { /* non-blocking */ }
        void (0, notificationService_js_1.sendPushNotificationToUser)(order.mitra_user_id, 'Pesanan Dibatalkan', `Pesanan #${id} dibatalkan oleh pembeli sebelum pembayaran.`, { type: 'order', route: '/profile', order_id: String(id), status: 'cancelled' });
        (0, response_js_1.sendSuccess)(res, { order_id: Number(id), status: 'cancelled' }, 'Pesanan berhasil dibatalkan.');
    }
    catch (error) {
        await connection.rollback().catch(() => { });
        console.error('❌ [cancelOrderByCustomer] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal membatalkan pesanan.');
    }
    finally {
        connection.release();
    }
};
exports.cancelOrderByCustomer = cancelOrderByCustomer;
// ============================================================
// GET /api/orders/:id/tracking — Timeline pelacakan pesanan
// ============================================================
const getOrderTracking = async (req, res) => {
    try {
        const userId = res.locals['userId'];
        const role = res.locals['role'];
        const { id } = req.params;
        const [orders] = await database_js_1.default.query(`SELECT o.id, o.user_id, o.status, o.tracking_number, o.shipping_method,
              o.shipping_cost, o.total_amount, t.gateway_fee, o.created_at,
              m.store_name, m.workshop_address,
              t.reference_code
       FROM orders o
       JOIN mitra_profiles m ON o.mitra_id = m.id
       LEFT JOIN transactions t ON o.transaction_id = t.id
       WHERE o.id = ?`, [id]);
        if (orders.length === 0) {
            (0, response_js_1.sendNotFound)(res, 'Pesanan tidak ditemukan.');
            return;
        }
        const order = orders[0];
        if (order.user_id !== userId && role !== 'admin') {
            // mitra pemilik toko juga boleh melihat
            const [own] = await database_js_1.default.query('SELECT id FROM mitra_profiles WHERE user_id = ? AND id = (SELECT mitra_id FROM orders WHERE id = ?)', [userId, id]);
            if (!own || own.length === 0) {
                (0, response_js_1.sendForbidden)(res, 'Anda tidak berhak melihat pelacakan pesanan ini.');
                return;
            }
        }
        const [history] = await database_js_1.default.query(`SELECT status, tracking_number, note, created_at
       FROM order_status_history
       WHERE order_id = ?
       ORDER BY id ASC`, [id]);
        const [items] = await database_js_1.default.query(`SELECT oi.product_id, oi.quantity, oi.unit_price, oi.variant,
              p.name AS product_name, p.image_urls
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`, [id]);
        const trackingTotals = computeOrderTotals(order);
        (0, response_js_1.sendSuccess)(res, {
            order_id: order.id,
            status: order.status,
            tracking_number: order.tracking_number,
            shipping_method: order.shipping_method,
            shipping_cost: Number(order.shipping_cost || 0),
            total_amount: Number(order.total_amount || 0),
            platform_fee: trackingTotals.platform,
            channel_fee: trackingTotals.channel,
            total_due: trackingTotals.total_due,
            reference_code: order.reference_code,
            store_name: order.store_name,
            created_at: order.created_at,
            timeline: history,
            items: items.map((it) => {
                let images = [];
                try {
                    const raw = it.image_urls;
                    if (Array.isArray(raw))
                        images = raw;
                    else if (typeof raw === 'string' && raw.trim()) {
                        images = raw.trim().startsWith('[') ? JSON.parse(raw) : [raw];
                    }
                }
                catch { /* ignore */ }
                return {
                    product_id: it.product_id,
                    product_name: it.product_name,
                    quantity: it.quantity,
                    unit_price: Number(it.unit_price),
                    variant: it.variant,
                    image: images[0] || null,
                };
            }),
        }, 'Timeline pelacakan berhasil diambil.');
    }
    catch (error) {
        console.error('❌ [getOrderTracking] Error:', error);
        (0, response_js_1.sendError)(res, 'Gagal mengambil timeline pelacakan.');
    }
};
exports.getOrderTracking = getOrderTracking;
exports.checkoutOrder = exports.checkout;
exports.getOrders = exports.getUserOrders;
exports.getOrderDetail = exports.getOrderById;
//# sourceMappingURL=orderController.js.map