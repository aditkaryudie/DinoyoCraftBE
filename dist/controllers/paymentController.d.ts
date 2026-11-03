import { Request, Response } from 'express';
export declare const getCountries: (_req: Request, res: Response) => Promise<void>;
export declare const getFees: (req: Request, res: Response) => Promise<void>;
export declare const getMethods: (req: Request, res: Response) => Promise<void>;
export declare const createOrderPayment: (req: Request, res: Response) => Promise<void>;
export declare const checkOrderStatus: (req: Request, res: Response) => Promise<void>;
export declare const handleWebhook: (req: Request, res: Response) => Promise<void>;
export declare const getPaymentMethods: typeof getMethods;
export declare const createPayment: typeof createOrderPayment;
export declare const getPaymentStatus: typeof checkOrderStatus;
export declare const simulatePayment: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=paymentController.d.ts.map