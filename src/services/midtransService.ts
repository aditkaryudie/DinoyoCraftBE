// @ts-ignore
import midtransClient from 'midtrans-client';
import dotenv from 'dotenv';

dotenv.config();

// Inisialisasi Snap API Instance
export const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY || '',
  clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
});
