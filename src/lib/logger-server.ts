import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Create logs directory if it doesn't exist
const logsDir = process.env.LOGS_DIR || path.join(process.cwd(), 'logs');

// Custom format for structured logging
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    ({ timestamp, level, message, ...metadata }) => {
      let msg = `${timestamp} [${level}]: ${message}`;
      if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata, null, 2)}`;
      }
      return msg;
    }
  )
);

// Create transport for all logs
const allLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: jsonFormat,
});

// Create transport for error logs
const errorLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: jsonFormat,
});

// Create transport for API logs
const apiLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'api-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '7d',
  format: jsonFormat,
});

// Create transport for database logs
const dbLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'database-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '7d',
  format: jsonFormat,
});

// Create transport for auth logs
const authLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'auth-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  format: jsonFormat,
});

// Create transport for sharing logs
const sharingLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'sharing-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: jsonFormat,
});

// Base logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: jsonFormat,
  transports: [
    allLogsTransport,
    errorLogsTransport,
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug',
  }));
}

// Create specialized loggers
export const apiLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: jsonFormat,
  defaultMeta: { service: 'api' },
  transports: [apiLogsTransport, allLogsTransport],
});

export const dbLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: jsonFormat,
  defaultMeta: { service: 'database' },
  transports: [dbLogsTransport, allLogsTransport],
});

export const authLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: jsonFormat,
  defaultMeta: { service: 'auth' },
  transports: [authLogsTransport, allLogsTransport],
});

export const sharingLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: jsonFormat,
  defaultMeta: { service: 'sharing' },
  transports: [sharingLogsTransport, allLogsTransport],
});

// Add console for development for specialized loggers
if (process.env.NODE_ENV !== 'production') {
  [apiLogger, dbLogger, authLogger, sharingLogger].forEach(specialLogger => {
    specialLogger.add(new winston.transports.Console({
      format: consoleFormat,
    }));
  });
}

// Context storage for request tracking
const requestContext = new Map<string, any>();

// Helper function to create request ID
export function createRequestId(): string {
  return uuidv4();
}

// Helper function to set request context
export function setRequestContext(requestId: string, context: any) {
  requestContext.set(requestId, context);
}

// Helper function to get request context
export function getRequestContext(requestId: string) {
  return requestContext.get(requestId);
}

// Helper function to clear request context
export function clearRequestContext(requestId: string) {
  requestContext.delete(requestId);
}

// Enhanced logging functions with request tracking
export function logWithContext(
  logger: winston.Logger,
  level: string,
  message: string,
  meta?: any
) {
  const requestId = meta?.requestId;
  const context = requestId ? getRequestContext(requestId) : {};
  
  logger.log(level, message, {
    ...context,
    ...meta,
    timestamp: new Date().toISOString(),
  });
}

// Log API request
export function logApiRequest(
  method: string,
  path: string,
  requestId: string,
  meta?: any
) {
  logWithContext(apiLogger, 'info', `API Request: ${method} ${path}`, {
    requestId,
    method,
    path,
    type: 'api_request',
    ...meta,
  });
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
  const level = statusCode >= 400 ? 'error' : 'info';
  logWithContext(apiLogger, level, `API Response: ${method} ${path} - ${statusCode}`, {
    requestId,
    method,
    path,
    statusCode,
    duration,
    type: 'api_response',
    ...meta,
  });
}

// Log database query
export function logDatabaseQuery(
  operation: string,
  model: string,
  duration: number,
  requestId?: string,
  meta?: any
) {
  logWithContext(dbLogger, 'debug', `Database Query: ${operation} on ${model}`, {
    requestId,
    operation,
    model,
    duration,
    type: 'database_query',
    ...meta,
  });
}

// Log authentication event
export function logAuthEvent(
  event: string,
  userId?: string,
  success: boolean = true,
  requestId?: string,
  meta?: any
) {
  const level = success ? 'info' : 'warn';
  logWithContext(authLogger, level, `Auth Event: ${event}`, {
    requestId,
    event,
    userId,
    success,
    type: 'auth_event',
    ...meta,
  });
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
  logWithContext(sharingLogger, 'info', `Sharing Event: ${event} ${resourceType}`, {
    requestId,
    event,
    resourceType,
    resourceId,
    userId,
    type: 'sharing_event',
    ...meta,
  });
}

// Log error with stack trace
export function logError(
  error: Error,
  context: string,
  requestId?: string,
  meta?: any
) {
  logger.error(`Error in ${context}: ${error.message}`, {
    requestId,
    context,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    type: 'error',
    ...meta,
  });
}

export default logger;