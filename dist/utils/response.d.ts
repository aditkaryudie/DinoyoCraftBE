import { Response } from 'express';
import { PaginationMeta } from '../types/index.js';
export declare const sendSuccess: <T>(res: Response, data: T, message?: string, statusCode?: number, meta?: PaginationMeta) => Response;
export declare const sendError: (res: Response, message: string, statusCode?: number, error?: string | Record<string, string[]>) => Response;
export declare const sendCreated: <T>(res: Response, data: T, message?: string) => Response;
export declare const sendUnauthorized: (res: Response, message?: string) => Response;
export declare const sendForbidden: (res: Response, message?: string) => Response;
export declare const sendNotFound: (res: Response, message?: string) => Response;
export declare const sendBadRequest: (res: Response, message?: string, error?: Record<string, string[]>) => Response;
//# sourceMappingURL=response.d.ts.map