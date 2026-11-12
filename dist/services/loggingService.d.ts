import { Request, Response } from 'express';
import Pusher from 'pusher';
export type LogSeverity = 'debug' | 'info' | 'success' | 'warning' | 'error' | 'critical';
export type LogOutcome = 'success' | 'failure' | 'pending' | 'info';
export type LogSource = 'backend' | 'web' | 'mobile' | 'worker' | 'external';
export type LogCategory = 'auth' | 'transaction' | 'order' | 'product_store' | 'cart_address' | 'chat' | 'notification' | 'moderation' | 'ai' | 'external' | 'mobile' | 'system' | 'admin_audit';
export interface SystemLogEventInput {
    eventId?: string;
    occurredAt?: Date | string;
    category: LogCategory | string;
    eventName: string;
    severity: LogSeverity;
    outcome: LogOutcome;
    message: string;
    source?: LogSource;
    service?: string;
    http?: {
        method: string;
        route: string;
        statusCode: number;
        durationMs: number;
    };
    correlation?: {
        requestId?: string | null;
        traceId?: string | null;
        userId?: number | null;
        role?: string | null;
        orderId?: number | null;
        transactionId?: number | null;
        referenceCode?: string | null;
    };
    client?: {
        platform?: string | null;
        appVersion?: string | null;
        ipMasked?: string | null;
        userAgent?: string | null;
    };
    error?: {
        code?: string | null;
        name?: string | null;
        message?: string | null;
        stack?: string | null;
        providerCode?: string | null;
    };
    metadata?: Record<string, unknown> | null;
    skipPusher?: boolean;
}
export declare const getPusherClient: () => Pusher | null;
export declare const generateEventId: () => string;
export declare const generateRequestId: () => string;
export declare const maskEmail: (email?: string | null) => string;
export declare const maskPhone: (phone?: string | null) => string;
export declare const maskIp: (ip?: string | null) => string;
export declare const sanitizeStack: (stack?: string | null) => string | null;
export declare const sanitizeText: (text?: string | null) => string;
export declare const sanitizeMetadata: (input: unknown, depth?: number) => Record<string, unknown> | null;
export declare const normalizeRouteTemplate: (rawUrl: string) => string;
export declare const classifyRouteCategory: (routeTemplate: string) => LogCategory;
export declare const deriveHttpStatusReason: (statusCode: number) => string;
export declare const computeRetentionExpiry: (severity: LogSeverity, fromDate?: Date) => Date;
export declare const ensureSystemLogsSchema: () => Promise<void>;
export declare const logSystemEvent: (input: SystemLogEventInput) => Promise<string | null>;
export declare const logHttpRequest: (req: Request, res: Response, durationMs: number) => void;
//# sourceMappingURL=loggingService.d.ts.map