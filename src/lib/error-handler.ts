import { NextResponse } from 'next/server'
import { debug } from './debug'

/**
 * アプリケーション全体で使用するエラーの種類
 */
export enum ErrorType {
  // 認証関連
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // バリデーション関連
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // リソース関連
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  
  // サーバーエラー
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  
  // レート制限
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

/**
 * エラーレスポンスの型定義
 */
export interface ErrorResponse {
  error: {
    type: ErrorType
    message: string
    details?: any
    timestamp: string
    requestId?: string
  }
}

/**
 * HTTPステータスコードのマッピング
 */
const errorStatusMap: Record<ErrorType, number> = {
  [ErrorType.UNAUTHORIZED]: 401,
  [ErrorType.FORBIDDEN]: 403,
  [ErrorType.INVALID_CREDENTIALS]: 401,
  [ErrorType.SESSION_EXPIRED]: 401,
  [ErrorType.VALIDATION_ERROR]: 400,
  [ErrorType.INVALID_INPUT]: 400,
  [ErrorType.MISSING_REQUIRED_FIELD]: 400,
  [ErrorType.NOT_FOUND]: 404,
  [ErrorType.ALREADY_EXISTS]: 409,
  [ErrorType.CONFLICT]: 409,
  [ErrorType.INTERNAL_ERROR]: 500,
  [ErrorType.DATABASE_ERROR]: 500,
  [ErrorType.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorType.RATE_LIMIT_EXCEEDED]: 429
}

/**
 * 標準的なエラーレスポンスを生成
 */
export function createErrorResponse(
  type: ErrorType,
  message: string,
  details?: any,
  requestId?: string
): NextResponse<ErrorResponse> {
  const status = errorStatusMap[type] || 500
  
  const errorResponse: ErrorResponse = {
    error: {
      type,
      message,
      timestamp: new Date().toISOString(),
      ...(details && { details }),
      ...(requestId && { requestId })
    }
  }
  
  // 開発環境でのみ詳細ログを出力
  debug.error('API Error:', {
    ...errorResponse.error,
    stack: details instanceof Error ? details.stack : undefined
  })
  
  return NextResponse.json(errorResponse, { status })
}

/**
 * Prismaのエラーをハンドリング
 */
export function handlePrismaError(error: any, requestId?: string): NextResponse<ErrorResponse> {
  debug.db('Prisma error:', error)
  
  // P2002: Unique constraint violation
  if (error.code === 'P2002') {
    const field = error.meta?.target?.[0] || 'field'
    return createErrorResponse(
      ErrorType.ALREADY_EXISTS,
      `${field}は既に使用されています`,
      { field },
      requestId
    )
  }
  
  // P2025: Record not found
  if (error.code === 'P2025') {
    return createErrorResponse(
      ErrorType.NOT_FOUND,
      'リソースが見つかりません',
      undefined,
      requestId
    )
  }
  
  // P2003: Foreign key constraint violation
  if (error.code === 'P2003') {
    return createErrorResponse(
      ErrorType.VALIDATION_ERROR,
      '関連するデータが存在しません',
      undefined,
      requestId
    )
  }
  
  // その他のPrismaエラー
  if (error.code?.startsWith('P')) {
    return createErrorResponse(
      ErrorType.DATABASE_ERROR,
      'データベースエラーが発生しました',
      { code: error.code },
      requestId
    )
  }
  
  // 一般的なエラー
  return createErrorResponse(
    ErrorType.INTERNAL_ERROR,
    'サーバーエラーが発生しました',
    error instanceof Error ? error.message : undefined,
    requestId
  )
}

/**
 * 認証エラーレスポンスを生成
 */
export function createAuthErrorResponse(message: string = '認証が必要です', requestId?: string) {
  return createErrorResponse(ErrorType.UNAUTHORIZED, message, undefined, requestId)
}

/**
 * バリデーションエラーレスポンスを生成
 */
export function createValidationErrorResponse(
  message: string,
  fields?: Record<string, string>,
  requestId?: string
) {
  return createErrorResponse(ErrorType.VALIDATION_ERROR, message, fields, requestId)
}

/**
 * エラーをキャッチしてレスポンスを返すラッパー
 */
export async function withErrorHandler<T>(
  handler: () => Promise<T>,
  requestId?: string
): Promise<T | NextResponse<ErrorResponse>> {
  try {
    return await handler()
  } catch (error: any) {
    if (error.code?.startsWith('P')) {
      return handlePrismaError(error, requestId)
    }
    
    return createErrorResponse(
      ErrorType.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'An unexpected error occurred',
      error instanceof Error ? error.stack : undefined,
      requestId
    )
  }
}