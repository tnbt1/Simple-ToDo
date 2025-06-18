# Todo App Logging Documentation

## Overview

This Todo app includes a comprehensive logging system that captures:
- API requests and responses
- Database queries
- Authentication events
- Error tracking with stack traces
- Task sharing and thread activities

All logs are structured in JSON format for easy parsing and analysis.

## Log Types

### 1. **All Logs** (`app-YYYY-MM-DD.log`)
Contains all log entries from all services.

### 2. **API Logs** (`api-YYYY-MM-DD.log`)
- HTTP request/response details
- Request IDs for tracing
- Response times
- Status codes
- Request/response headers

### 3. **Authentication Logs** (`auth-YYYY-MM-DD.log`)
- User registration events
- Login/logout events
- Authentication failures
- Session management

### 4. **Database Logs** (`database-YYYY-MM-DD.log`)
- Query operations (SELECT, INSERT, UPDATE, DELETE)
- Query execution times
- Query parameters (in development mode)
- Database errors

### 5. **Error Logs** (`error-YYYY-MM-DD.log`)
- All error-level logs
- Stack traces
- Error context
- Request IDs for correlation

### 6. **Sharing Logs** (`sharing-YYYY-MM-DD.log`)
- Task sharing events
- Category sharing events
- Permission changes
- Share link generation

## Log Structure

Each log entry contains:

```json
{
  "timestamp": "2025-06-16 14:30:45.123",
  "level": "info",
  "message": "API Request: GET /api/tasks",
  "service": "api",
  "requestId": "abc123-def456-ghi789",
  "type": "api_request",
  "method": "GET",
  "path": "/api/tasks",
  "userId": "user_123",
  "duration": 45,
  "statusCode": 200
}
```

## Using the Log Management Scripts

### 1. View Logs in Real-Time

```bash
# View all logs
./scripts/logs/view-logs.sh

# View specific log type
./scripts/logs/view-logs.sh api
./scripts/logs/view-logs.sh auth
./scripts/logs/view-logs.sh db
./scripts/logs/view-logs.sh error
./scripts/logs/view-logs.sh sharing

# View without following (snapshot)
./scripts/logs/view-logs.sh api false
```

### 2. Filter Logs

```bash
# Filter by log level
./scripts/logs/filter-logs.sh app level error

# Filter by request ID
./scripts/logs/filter-logs.sh api request abc123-def456

# Filter by user
./scripts/logs/filter-logs.sh auth user user_123

# Filter by HTTP status
./scripts/logs/filter-logs.sh api status 500

# Filter by time (last N minutes)
./scripts/logs/filter-logs.sh all time 30

# Show only errors with stack traces
./scripts/logs/filter-logs.sh error error
```

### 3. Export Logs

```bash
# Export today's logs as JSON
./scripts/logs/export-logs.sh

# Export last week as CSV
./scripts/logs/export-logs.sh csv week

# Generate monthly summary
./scripts/logs/export-logs.sh summary month

# Generate detailed report
./scripts/logs/export-logs.sh report week
```

### 4. Analyze Performance

```bash
# Analyze today's performance
./scripts/logs/analyze-performance.sh

# Analyze specific date
./scripts/logs/analyze-performance.sh 2025-06-15
```

## Configuration

Edit `.env.logging` to configure:

```bash
# Log level (error, warn, info, http, debug)
LOG_LEVEL=info

# Log directory
LOGS_DIR=/home/tnbt/todo-app/logs

# Log retention (days)
LOG_RETENTION_DAYS=30

# Performance thresholds
SLOW_QUERY_THRESHOLD=100
SLOW_API_THRESHOLD=1000
```

## Request Tracing

Every API request is assigned a unique Request ID (`x-request-id` header) that's propagated through:
- API logs
- Database queries
- Authentication events
- Error logs

This allows you to trace a single request through the entire system:

```bash
# Find all logs for a specific request
./scripts/logs/filter-logs.sh all request "abc123-def456-ghi789"
```

## Performance Monitoring

The system automatically tracks:
- API response times
- Database query execution times
- Slow queries (configurable threshold)
- Error rates
- Request patterns

Use the performance analysis script to get insights:

```bash
./scripts/logs/analyze-performance.sh
```

This provides:
- Response time percentiles (50th, 95th, 99th)
- Slowest endpoints
- Most frequent endpoints
- Error rate analysis
- Hourly request distribution
- Performance recommendations

## Testing Different Features

To test logging for various features:

### 1. Test Authentication Logging
```bash
# Watch auth logs
./scripts/logs/view-logs.sh auth

# In another terminal, register a new user
curl -X POST http://localhost:3100/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
```

### 2. Test API Logging
```bash
# Watch API logs
./scripts/logs/view-logs.sh api

# Make various API calls
curl http://localhost:3100/api/tasks
curl -X POST http://localhost:3100/api/tasks -H "Content-Type: application/json" -d '{"title":"Test Task"}'
```

### 3. Test Error Logging
```bash
# Watch error logs
./scripts/logs/view-logs.sh error

# Trigger an error (e.g., invalid request)
curl -X POST http://localhost:3100/api/tasks -H "Content-Type: application/json" -d 'invalid json'
```

### 4. Test Database Logging
```bash
# Watch database logs
./scripts/logs/view-logs.sh db

# Perform operations that trigger database queries
```

### 5. Test Sharing Logging
```bash
# Watch sharing logs
./scripts/logs/view-logs.sh sharing

# Share a task via the UI or API
```

## Log Rotation

Logs are automatically rotated daily with:
- Date-based filenames
- Configurable retention period
- Automatic compression of old logs
- Maximum file size limits

## Security Considerations

- Sensitive data (passwords, tokens) are never logged
- User passwords are hashed before storage
- Request bodies are logged only in development mode
- Database query parameters are logged only in development mode

## Troubleshooting

### No logs appearing
1. Check if the logs directory exists: `ls -la /home/tnbt/todo-app/logs/`
2. Verify the app is running with proper permissions
3. Check environment variables are loaded

### Performance impact
- Logging is asynchronous and shouldn't impact request performance
- Use appropriate log levels in production (info or warn)
- Monitor disk space usage for log files

### Missing request IDs
- Ensure the middleware is properly configured
- Check that all API routes use the logging wrapper

## Best Practices

1. **Use appropriate log levels**:
   - `error`: For errors that need immediate attention
   - `warn`: For potentially harmful situations
   - `info`: For general informational messages
   - `debug`: For detailed debugging information

2. **Include context**: Always include relevant context (user ID, request ID, etc.)

3. **Monitor regularly**: Set up alerts for error rates and performance degradation

4. **Clean up old logs**: Use the retention settings to automatically remove old logs

5. **Export for analysis**: Regularly export and analyze logs for trends and issues