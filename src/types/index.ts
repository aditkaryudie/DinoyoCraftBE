// ============================================================
//  src/types/index.ts
//  Tipe-tipe global yang digunakan di seluruh aplikasi backend
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { RowDataPacket } from 'mysql2';

// -----------------------------------------------------------
// 1. JWT Payload
// -----------------------------------------------------------
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

// -----------------------------------------------------------
// 2. Peran Pengguna
// -----------------------------------------------------------
export type UserRole = 'admin' | 'mitra' | 'pengunjung';

// -----------------------------------------------------------
// 3. Standarisasi Format Response API
// -----------------------------------------------------------
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

// -----------------------------------------------------------
// 4. Augmentasi res.locals untuk menyimpan data auth
// -----------------------------------------------------------
export interface AuthLocals {
  userId: number;
  email: string;
  role: UserRole;
}

// -----------------------------------------------------------
// 5. Tipe untuk Express dengan typing yang ketat
// -----------------------------------------------------------
export type TypedRequest<
  TBody = Record<string, unknown>,
  TQuery = Record<string, string>,
  TParams = Record<string, string>
> = Request<TParams, ApiResponse, TBody, TQuery>;

export type TypedResponse<T = unknown> = Response<ApiResponse<T>>;

export type ExpressMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

export type ExpressErrorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void;

// -----------------------------------------------------------
// 6. Entitas Database — extend RowDataPacket agar kompatibel
//    dengan mysql2's typed generics
// -----------------------------------------------------------
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

// -----------------------------------------------------------
// 7. DTO (Data Transfer Objects) — Request Bodies
// -----------------------------------------------------------
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
