import 'dotenv/config';
/**
 * Membuat transporter Gmail SMTP secara dinamis dari environment variables
 */
export declare const getTransporter: () => import("nodemailer").Mail<import("nodemailer").SMTPSentMessageInfo, import("nodemailer").SMTPTransportOptions>;
/**
 * Kirim kode OTP ke email user dengan template branded DinoyoCraft
 */
export declare const sendOTPEmail: (toEmail: string, otpCode: string, recipientName?: string) => Promise<void>;
//# sourceMappingURL=emailService.d.ts.map