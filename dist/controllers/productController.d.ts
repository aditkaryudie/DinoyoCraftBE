import { Request, Response } from 'express';
export interface ProductVariantItem {
    name: string;
    hex: string;
    label: string;
    stock: number;
}
export declare const parseImageUrls: (raw: unknown) => string[];
export declare const parseVariants: (raw: unknown) => ProductVariantItem[];
export declare const serializeVariantsInput: (raw: unknown) => ProductVariantItem[] | null;
export declare const getVariantAvailableStock: (rawVariants: unknown, totalStock: number, variantName?: string | null) => number;
export declare const adjustProductStockAndVariant: (connection: any, productId: number, deltaQty: number, variantName?: string | null) => Promise<void>;
export declare const getProdukMitra: (req: Request, res: Response) => Promise<void>;
export declare const tambahProduk: (req: Request, res: Response) => Promise<void>;
export declare const hapusProduk: (req: Request, res: Response) => Promise<void>;
export declare const getPublicProducts: (req: Request, res: Response) => Promise<void>;
export declare const getPublicProductDetail: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=productController.d.ts.map