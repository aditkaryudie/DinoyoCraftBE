import { Request, Response } from 'express';
export declare const getUserNotifications: (_req: Request, res: Response) => Promise<void>;
export declare const getUnreadNotificationCount: (_req: Request, res: Response) => Promise<void>;
export declare const markAsRead: (req: Request, res: Response) => Promise<void>;
export declare const markAllAsRead: (_req: Request, res: Response) => Promise<void>;
export declare const deleteNotification: (req: Request, res: Response) => Promise<void>;
export declare const getNotifications: typeof getUserNotifications;
export declare const getUnreadCount: typeof getUnreadNotificationCount;
//# sourceMappingURL=notificationController.d.ts.map