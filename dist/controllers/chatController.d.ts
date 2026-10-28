import { Request, Response } from 'express';
/**
 * Mengirim pesan baru dan mentrigger event real-time ke Pusher
 * POST /api/chat/send/:targetUserId
 */
export declare const sendMessage: (req: Request, res: Response) => Promise<void>;
/**
 * Mengambil riwayat pesan antara pengguna yang sedang login dan target user
 * GET /api/chat/messages/:targetUserId
 */
export declare const getMessages: (req: Request, res: Response) => Promise<void>;
export declare const getChatHistory: typeof getMessages;
/**
 * Mengambil daftar kontak percakapan yang tersedia untuk user yang sedang login
 * GET /api/chat/contacts
 */
export declare const getChatContacts: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=chatController.d.ts.map