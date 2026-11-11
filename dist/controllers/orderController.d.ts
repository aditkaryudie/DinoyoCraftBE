import { Request, Response } from 'express';
export declare function recordOrderStatusHistory(orderId: number, status: string, trackingNumber?: string | null, note?: string | null, conn?: any): Promise<void>;
export declare function computeOrderTotals(o: {
    total_amount: any;
    gateway_fee?: any;
}): {
    base: number;
    platform: number;
    channel: number;
    total_due: number;
};
export declare const checkout: (req: Request, res: Response) => Promise<void>;
export declare const getUserOrders: (req: Request, res: Response) => Promise<void>;
export declare const getOrderById: (req: Request, res: Response) => Promise<void>;
export declare const getMitraOrders: (req: Request, res: Response) => Promise<void>;
export declare const updateOrderStatus: (req: Request, res: Response) => Promise<void>;
export declare const confirmOrderCompleted: (req: Request, res: Response) => Promise<void>;
export declare const cancelOrderByCustomer: (req: Request, res: Response) => Promise<void>;
export declare const getOrderTracking: (req: Request, res: Response) => Promise<void>;
export declare const checkoutOrder: typeof checkout;
export declare const getOrders: typeof getUserOrders;
export declare const getOrderDetail: typeof getOrderById;
//# sourceMappingURL=orderController.d.ts.map