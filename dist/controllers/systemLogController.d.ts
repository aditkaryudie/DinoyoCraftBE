import { Request, Response } from 'express';
export declare const getSystemLogs: (req: Request, res: Response) => Promise<void>;
export declare const getSystemLogsSummary: (req: Request, res: Response) => Promise<void>;
export declare const getSystemLogDetail: (req: Request, res: Response) => Promise<void>;
export declare const getRelatedSystemLogs: (req: Request, res: Response) => Promise<void>;
export declare const acknowledgeSystemLog: (req: Request, res: Response) => Promise<void>;
export declare const exportSystemLogsCsv: (req: Request, res: Response) => Promise<void>;
export declare const softDeleteSystemLog: (req: Request, res: Response) => Promise<void>;
export declare const bulkDeleteSystemLogs: (req: Request, res: Response) => Promise<void>;
export declare const restoreSystemLog: (req: Request, res: Response) => Promise<void>;
export declare const purgeSystemLog: (req: Request, res: Response) => Promise<void>;
export declare const authorizePusherChannel: (req: Request, res: Response) => Promise<void>;
export declare const ingestClientLog: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=systemLogController.d.ts.map