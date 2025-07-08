/**
 * デバッグログ用のユーティリティ
 * 開発環境でのみコンソールに出力
 */

const isDevelopment = process.env.NODE_ENV === 'development'

export const debug = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args)
    }
  },
  
  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error(...args)
    }
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args)
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args)
    }
  },
  
  /**
   * APIエンドポイント用のログ
   */
  api: (method: string, path: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`[API] ${method} ${path}`, ...args)
    }
  },
  
  /**
   * SSE関連のログ
   */
  sse: (event: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`[SSE] ${event}`, ...args)
    }
  },
  
  /**
   * データベース関連のログ
   */
  db: (operation: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`[DB] ${operation}`, ...args)
    }
  },
  
  /**
   * 認証関連のログ
   */
  auth: (event: string, ...args: any[]) => {
    if (isDevelopment) {
      console.log(`[Auth] ${event}`, ...args)
    }
  }
}