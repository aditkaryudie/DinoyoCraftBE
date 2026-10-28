import { Request, Response } from 'express';
export declare const registerMitra: (req: Request, res: Response) => Promise<void>;
export declare const loginMitra: (req: Request, res: Response) => Promise<void>;
export declare const googleLogin: (req: Request, res: Response) => Promise<void>;
export declare const getProfile: (_req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updateProfile: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const forgotPassword: (req: Request, res: Response) => Promise<void>;
export declare const verifyOtp: (req: Request, res: Response) => Promise<void>;
export declare const resetPassword: (req: Request, res: Response) => Promise<void>;
export declare const reuploadDocs: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=authController.d.ts.map