"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMidtransNotification = exports.createMidtransTransaction = void 0;
const midtransService_1 = require("../services/midtransService");
const createMidtransTransaction = async (req, res) => {
    try {
        const { orderId, grossAmount, customerDetails } = req.body;
        // Parameter yang dikirim ke Midtrans Snap
        const parameter = {
            transaction_details: {
                order_id: `ORDER-${orderId}-${Date.now()}`, // Pastikan unik
                gross_amount: grossAmount,
            },
            customer_details: {
                first_name: customerDetails?.name,
                email: customerDetails?.email,
                phone: customerDetails?.phone,
            },
            // Opsional: Atur item details jika diperlukan
        };
        // Minta Snap Token ke Midtrans
        const transaction = await midtransService_1.snap.createTransaction(parameter);
        // Simpan transaction.token dan redirect_url ke database jika perlu
        return res.status(200).json({
            success: true,
            message: 'Berhasil membuat token pembayaran',
            data: {
                token: transaction.token,
                redirect_url: transaction.redirect_url,
            },
        });
    }
    catch (error) {
        console.error('Midtrans Error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Gagal membuat transaksi pembayaran',
            error: error.message,
        });
    }
};
exports.createMidtransTransaction = createMidtransTransaction;
const handleMidtransNotification = async (req, res) => {
    try {
        const notificationStatus = await midtransService_1.snap.transaction.notification(req.body);
        const orderId = notificationStatus.order_id;
        const transactionStatus = notificationStatus.transaction_status;
        const fraudStatus = notificationStatus.fraud_status;
        console.log(`Notifikasi diterima untuk Order ID: ${orderId}, Status: ${transactionStatus}, Fraud: ${fraudStatus}`);
        // Logika status pembayaran Midtrans:
        // - capture (accept) / settlement -> pembayaran berhasil
        // - pending -> menunggu pembayaran
        // - deny / cancel / expire -> pembayaran gagal / kadaluarsa
        // Tambahkan logika update status order di database sesuai kebutuhan
        return res.status(200).json({ success: true, message: 'Notifikasi berhasil diproses' });
    }
    catch (error) {
        console.error('Webhook Error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};
exports.handleMidtransNotification = handleMidtransNotification;
//# sourceMappingURL=paymentController.js.map