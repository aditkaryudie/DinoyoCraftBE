// ============================================================
//  src/utils/emailService.ts
//  Nodemailer Email Service — Kirim OTP via Gmail SMTP
// ============================================================

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env['EMAIL_USER'],
    pass: process.env['EMAIL_PASS'],
  },
});

/**
 * Kirim kode OTP ke email user
 */
export const sendOTPEmail = async (toEmail: string, otpCode: string): Promise<void> => {
  const mailOptions = {
    from: `"DinoyoCraft Portal" <${process.env['EMAIL_USER']}>`,
    to: toEmail,
    subject: 'Kode OTP Verifikasi - DinoyoCraft',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #faf7f5; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #2d2a26; margin: 0;">DinoyoCraft</h2>
          <p style="color: #8a7968; font-size: 14px; margin-top: 4px;">Portal Mitra</p>
        </div>
        <div style="background: #fff; border-radius: 12px; padding: 28px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <p style="color: #555; font-size: 14px; margin: 0 0 16px;">Kode OTP verifikasi kamu adalah:</p>
          <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #2d2a26; background: #f5f0eb; border-radius: 8px; padding: 16px; margin: 0 auto; display: inline-block;">
            ${otpCode}
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            Kode ini berlaku selama <strong>5 menit</strong>.<br/>
            Jangan bagikan kode ini kepada siapa pun.
          </p>
        </div>
        <p style="color: #bbb; font-size: 11px; text-align: center; margin-top: 20px;">
          &copy; ${new Date().getFullYear()} DinoyoCraft. Hak Cipta Dilindungi.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};
