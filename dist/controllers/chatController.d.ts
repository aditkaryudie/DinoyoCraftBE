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
/**
 * Mengambil total jumlah pesan belum dibaca untuk user yang sedang login.
 * GET /api/chat/unread-count
 */
export declare const getUnreadChatCount: (req: Request, res: Response) => Promise<void>;
/**
 * Menandai pesan dari targetUserId kepada user login sebagai sudah dibaca.
 * PATCH /api/chat/messages/:targetUserId/read
 */
export declare const markConversationAsRead: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=chatController.d.ts.map