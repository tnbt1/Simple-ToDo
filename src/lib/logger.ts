// This file provides a runtime-safe logger interface that works in both Edge and Node.js environments
// It conditionally loads the actual Winston logger only when running on the server

// type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'debug';
// type LogMeta = Record<string, any>;

// Helper function to check if we're in a server environment
function isServerEnvironment(): boolean {
  return typeof window === 'undefined' && typeof process !== 'undefined' && !!process.versions && !!process.versions.node;
}

// Lazy-loaded server logger
let serverLogger: any = null;

function getServerLogger() {
  if (!isServerEnvironment()) {
    return null;
  }
  
  if (!serverLogger) {
    try {
      // Dynamic import to avoid Edge Runtime issues
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      serverLogger = require('./logger-server');
    } catch (error) {
      console.error('Failed to load server logger:', error);
      return null;
    }
  }
  
  return serverLogger;
}

// Stub functions that only log on the server
function createStubFunction(functionName: string) {
  return (...args: any[]) => {
    const logger = getServerLogger();
    if (logger && logger[functionName]) {
      return logger[functionName](...args);
    }
    // In Edge runtime or client, just log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${functionName}]`, ...args);
    }
  };
}

// Export stub functions that work in all environments
export const createRequestId = createStubFunction('createRequestId');
export const setRequestContext = createStubFunction('setRequestContext');
export const getRequestContext = createStubFunction('getRequestContext');
export const clearRequestContext = createStubFunction('clearRequestContext');
export const logWithContext = createStubFunction('logWithContext');

// Log API request
export function logApiRequest(
  method: string,
  path: string,
  requestId: string,
  meta?: any
) {
  const logger = getServerLogger();
  if (logger && logger.logApiRequest) {
    return logger.logApiRequest(method, path, requestId, meta);
  }
  if (process.env.NODE_ENV === 'development') {
    console.log(`[API Request] ${method} ${path}`, { requestId, ...meta });
  }
}

// Log API response
export function logApiResponse(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  requestId: string,
  meta?: any
) {
  const logger = getServerLogger();
  if (logger && logger.logApiResponse) {
    return logger.logApiResponse(method, path, statusCode, duration, requestId, meta);
  }
  if (process.env.NODE_ENV === 'development') {
    const level = statusCode >= 400 ? 'error' : 'log';
    console[level](`[API Response] ${method} ${path} - ${statusCode} (${duration}ms)`, { requestId, ...meta });
  }
}

// Log database query
export function logDatabaseQuery(
  operation: string,
  model: string,
  duration: number,
  requestId?: string,
  meta?: any
) {
  const logger = getServerLogger();
  if (logger && logger.logDatabaseQuery) {
    return logger.logDatabaseQuery(operation, model, duration, requestId, meta);
  }
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Database Query] ${operation} on ${model} (${duration}ms)`, { requestId, ...meta });
  }
}

// Log authentication event
export function logAuthEvent(
  event: string,
  userId?: string,
  success: boolean = true,
  requestId?: string,
  meta?: any
) {
  const logger = getServerLogger();
  if (logger && logger.logAuthEvent) {
    return logger.logAuthEvent(event, userId, success, requestId, meta);
  }
  if (process.env.NODE_ENV === 'development') {
    const level = success ? 'log' : 'warn';
    console[level](`[Auth Event] ${event}`, { userId, success, requestId, ...meta });
  }
}

// Log sharing event
export function logSharingEvent(
  event: string,
  resourceType: string,
  resourceId: string,
  userId: string,
  requestId?: string,
  meta?: any
) {
  const logger = getServerLogger();
  if (logger && logger.logSharingEvent) {
    return logger.logSharingEvent(event, resourceType, resourceId, userId, requestId, meta);
  }
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Sharing Event] ${event} ${resourceType}`, { resourceId, userId, requestId, ...meta });
  }
}

// Log error with stack trace
export function logError(
  error: Error,
  context: string,
  requestId?: string,
  meta?: any
) {
  const logger = getServerLogger();
  if (logger && logger.logError) {
    return logger.logError(error, context, requestId, meta);
  }
  console.error(`[Error] in ${context}: ${error.message}`, {
    requestId,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    ...meta,
  });
}

// Default export for compatibility
const defaultLogger = {
  error: (message: string, meta?: any) => logError(new Error(message), 'general', undefined, meta),
  warn: (message: string, meta?: any) => console.warn(`[Logger] ${message}`, meta),
  info: (message: string, meta?: any) => console.log(`[Logger] ${message}`, meta),
  debug: (message: string, meta?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Logger] ${message}`, meta);
    }
  },
};

export default defaultLogger;