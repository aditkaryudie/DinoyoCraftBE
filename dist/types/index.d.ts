import { Request, Response, NextFunction } from 'express';
import { RowDataPacket } from 'mysql2';
export interface JwtPayload {
    userId: number;
    email: string;
    role: UserRole;
    iat?: number;
    exp?: number;
}
export interface JwtRefreshPayload {
    userId: number;
    tokenVersion: number;
    iat?: number;
    exp?: number;
}
export type UserRole = 'admin' | 'mitra' | 'pengunjung';
export interface ApiResponse<T = unknown> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string | Record<string, string[]>;
    meta?: PaginationMeta;
}
export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export interface AuthLocals {
    userId: number;
    email: string;
    role: UserRole;
}
export type TypedRequest<TBody = Record<string, unknown>, TQuery = Record<string, string>, TParams = Record<string, string>> = Request<TParams, ApiResponse, TBody, TQuery>;
export type TypedResponse<T = unknown> = Response<ApiResponse<T>>;
export type ExpressMiddleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
export type ExpressErrorMiddleware = (err: Error, req: Request, res: Response, next: NextFunction) => void;
export interface UserEntity extends RowDataPacket {
    id: number;
    name: string;
    email: string;
    password_hash: string;
    role: UserRole;
    is_active: boolean;
    token_version: number;
    created_at: Date;
    updated_at: Date;
}
export type SafeUser = Omit<UserEntity, 'password_hash' | 'token_version'>;
export interface MasterDataEntity extends RowDataPacket {
    id: number;
    category: string;
    key: string;
    value: string;
    description?: string;
    created_by: number;
    created_at: Date;
    updated_at: Date;
}
export interface TransactionEntity extends RowDataPacket {
    id: number;
    user_id: number;
    transaction_type: string;
    amount: number;
    status: 'pending' | 'success' | 'failed' | 'cancelled';
    reference_code: string;
    notes?: string;
    created_at: Date;
    updated_at: Date;
}
export interface AiAnalysisEntity extends RowDataPacket {
    id: number;
    user_id: number;
    prompt_context: string;
    ai_response: Record<string, unknown>;
    model_used: string;
    tokens_used?: number;
    processing_time_ms?: number;
    created_at: Date;
}
export interface AuditLogEntity extends RowDataPacket {
    id: number;
    user_id?: number;
    action: string;
    table_name?: string;
    record_id?: number;
    old_values?: Record<string, unknown>;
    new_values?: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
    created_at: Date;
}
export interface CountResult extends RowDataPacket {
    total: number;
}
export interface RegisterDto {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
}
export interface LoginDto {
    email: string;
    password: string;
}
export interface AiAnalysisDto {
    context: string;
    productCategory?: string;
    targetMarket?: string;
    additionalNotes?: string;
}
export interface CreateMasterDataDto {
    category: string;
    key: string;
    value: string;
    description?: string;
}
//# sourceMappingURL=index.d.ts.map