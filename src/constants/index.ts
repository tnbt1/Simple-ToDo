// タスクの優先度
export const PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH'
} as const

// タスクのステータス
export const TASK_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED'
} as const

// ソート順
export const SORT_BY = {
  DUE_DATE: 'dueDate',
  PRIORITY: 'priority',
  TITLE: 'title',
  CREATED_AT: 'createdAt'
} as const

// フィルターステータス
export const FILTER_STATUS = {
  ALL: 'all',
  PENDING: 'pending',
  COMPLETED: 'completed'
} as const

// 優先度の並び順
export const PRIORITY_ORDER = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2
} as const

// タイムアウト設定
export const TIMEOUTS = {
  COPY_FEEDBACK: 2000,
  ERROR_DISPLAY: 5000,
  TASK_SUBMISSION: 5000,
  SSE_FALLBACK_INTERVAL: 30000,
  SSE_RECONNECT_DELAY: 1000,
  SSE_MAX_RECONNECT_DELAY: 15000
} as const

// SSE設定
export const SSE_CONFIG = {
  RECONNECT_DELAY: 1000,
  MAX_RECONNECT_DELAY: 15000,
  MAX_RECONNECT_ATTEMPTS: 20
} as const

// ローカルストレージキー
export const STORAGE_KEYS = {
  DARK_MODE: 'darkMode',
  READ_MESSAGE_COUNTS: 'readMessageCounts'
} as const