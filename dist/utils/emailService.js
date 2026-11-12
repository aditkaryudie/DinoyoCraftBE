"use strict";
// ============================================================
//  src/utils/emailService.ts
//  Nodemailer Email Service — Kirim OTP via Gmail SMTP
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOTPEmail = exports.getTransporter = void 0;
require("dotenv/config");
const nodemailer_1 = __importDefault(require("nodemailer"));
/**
 * Membuat transporter Gmail SMTP secara dinamis dari environment variables
 */
const getTransporter = () => {
    const user = process.env['EMAIL_USER'];
    const pass = process.env['EMAIL_PASS'];
    if (!user || !pass) {
        console.error('⚠️ [EMAIL CONFIG] EMAIL_USER atau EMAIL_PASS belum terdefinisi di .env!');
    }
    return nodemailer_1.default.createTransport({
        service: 'gmail',
        auth: {
            user: user || '',
            pass: pass || '',
        },
    });
};
exports.getTransporter = getTransporter;
/**
 * Kirim kode OTP ke email user dengan template branded DinoyoCraft
 */
const sendOTPEmail = async (toEmail, otpCode, recipientName = 'Pengguna') => {
    const logoUrl = 'https://raw.githubusercontent.com/alifarda126/DinoyoCraftApp/main/assets/images/branding/Logo.png';
    const mailOptions = {
        from: `"DinoyoCraft Portal" <${process.env['EMAIL_USER'] || 'csdinoyocraft@gmail.com'}>`,
        to: toEmail,
        subject: 'Kode OTP Verifikasi - DinoyoCraft',
        html: `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Kode OTP DinoyoCraft</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #F8F6F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8F6F2; padding: 40px 15px;">
          <tr>
            <td align="center">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(184, 92, 60, 0.08); border: 1px solid #ECE3DA;">
                <tr>
                  <td style="background: linear-gradient(135deg, #B85C3C 0%, #8C4328 100%); height: 8px;"></td>
                </tr>
                <tr>
                  <td style="padding: 40px 36px 36px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                      <tr>
                        <td align="center">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 12px;">
                            <tr>
                              <td align="center" style="width: 76px; height: 76px; padding: 0;">
                                <img src="${logoUrl}" alt="DinoyoCraft Logo" width="76" height="76" style="width: 76px; height: 76px; object-fit: contain; display: block; border: 0;" />
                              </td>
                            </tr>
                          </table>
                          <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #2D2A26; letter-spacing: -0.03em;">DinoyoCraft</h1>
                          <p style="margin: 4px 0 0; font-size: 12px; font-weight: 700; color: #B85C3C; letter-spacing: 0.08em; text-transform: uppercase;">Sentra Kerajinan Keramik Dinoyo Malang</p>
                        </td>
                      </tr>
                    </table>

                    <div style="height: 1px; background-color: #ECE3DA; margin-bottom: 24px;"></div>

                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="color: #4A4641; font-size: 15px; line-height: 1.65;">
                          <p style="margin: 0 0 14px; font-size: 17px; font-weight: 700; color: #2D2A26;">
                            Kode Verifikasi Akun
                          </p>
                          <p style="margin: 0 0 10px;">
                            Halo <strong style="color: #2D2A26;">${recipientName}</strong>,
                          </p>
                          <p style="margin: 0 0 20px; color: #66615B; font-size: 14.5px;">
                            Berikut adalah kode One-Time Password (OTP) Anda untuk verifikasi keamanan akun DinoyoCraft:
                          </p>
                        </td>
                      </tr>

                      <tr>
                        <td align="center">
                          <div style="background: linear-gradient(135deg, #FFF9F6 0%, #FDF3EB 100%); border: 2px dashed #B85C3C; border-radius: 16px; padding: 22px 16px; margin: 0 auto 24px; text-align: center;">
                            <span style="display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: #8C4328; text-transform: uppercase; margin-bottom: 8px;">
                              Kode Verifikasi OTP Anda
                            </span>
                            <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #B85C3C; text-indent: 10px; padding: 4px 0;">
                              ${otpCode}
                            </div>
                            <div style="margin-top: 10px;">
                              <span style="display: inline-block; background: #FEE2E2; color: #DC2626; padding: 4px 14px; border-radius: 999px; font-size: 12px; font-weight: 600;">
                                ⏱️ Berlaku selama 5 menit
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td>
                          <div style="background-color: #FAF8F5; border-left: 4px solid #B85C3C; border-radius: 0 10px 10px 0; padding: 14px 16px; margin-bottom: 28px;">
                            <p style="margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #2D2A26;">
                              🛡️ Catatan Keamanan:
                            </p>
                            <p style="margin: 0; font-size: 12.5px; color: #706B65; line-height: 1.55;">
                              &bull; Jangan pernah membagikan kode OTP ini kepada siapa pun, termasuk pihak yang mengatasnamakan DinoyoCraft.<br/>
                              &bull; Jika Anda tidak melakukan aktivitas ini, abaikan pesan ini demi keamanan akun Anda.
                            </p>
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td style="border-top: 1px solid #ECE3DA; padding-top: 24px; text-align: center;">
                          <p style="margin: 0 0 6px; font-size: 12px; color: #8A7968;">
                            Butuh bantuan? Hubungi Tim Dukungan DinoyoCraft di <a href="mailto:csdinoyocraft@gmail.com" style="color: #B85C3C; font-weight: 600; text-decoration: none;">csdinoyocraft@gmail.com</a>
                          </p>
                          <p style="margin: 0; font-size: 11px; color: #A89B8C; line-height: 1.5;">
                            Sentra Kerajinan Keramik Dinoyo, Kota Malang, Jawa Timur<br/>
                            &copy; ${new Date().getFullYear()} DinoyoCraft. Hak Cipta Dilindungi.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    };
    try {
        const transporter = (0, exports.getTransporter)();
        await transporter.sendMail(mailOptions);
        console.log(`✅ [EMAIL SUCCESS] Kode OTP berhasil dikirim ke: ${toEmail}`);
    }
    catch (error) {
        console.error(`❌ [EMAIL ERROR] Gagal mengirim email OTP ke ${toEmail}:`, error.message);
        throw error;
    }
};
exports.sendOTPEmail = sendOTPEmail;
//# sourceMappingURL=emailService.js.map