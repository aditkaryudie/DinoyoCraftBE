import { Request, Response } from 'express';
export declare const checkout: (req: Request, res: Response) => Promise<void>;
export declare const getUserOrders: (req: Request, res: Response) => Promise<void>;
export declare const getOrderById: (req: Request, res: Response) => Promise<void>;
export declare const getMitraOrders: (req: Request, res: Response) => Promise<void>;
export declare const updateOrderStatus: (req: Request, res: Response) => Promise<void>;
export declare const checkoutOrder: typeof checkout;
export declare const getOrders: typeof getUserOrders;
export declare const getOrderDetail: typeof getOrderById;
//# sourceMappingURL=orderController.d.ts.map