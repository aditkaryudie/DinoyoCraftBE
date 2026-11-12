import { Request, Response } from 'express';
export declare const getCart: (_req: Request, res: Response) => Promise<void>;
export declare const addToCart: (req: Request, res: Response) => Promise<void>;
export declare const updateCartItem: (req: Request, res: Response) => Promise<void>;
export declare const deleteCartItem: (req: Request, res: Response) => Promise<void>;
export declare const clearCart: (_req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=cartController.d.ts.map