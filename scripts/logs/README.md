# Todo App Logging Scripts

This directory contains scripts for managing and analyzing logs from the Todo application.

## Quick Start

1. **Initialize logging system:**
   ```bash
   ./scripts/init-logging.sh
   ```

2. **View logs in real-time:**
   ```bash
   ./scripts/logs/view-logs.sh          # All logs
   ./scripts/logs/view-logs.sh api      # API logs only
   ./scripts/logs/view-logs.sh error    # Error logs only
   ```

3. **Test logging system:**
   ```bash
   ./scripts/test-logging.sh
   ```

## Available Scripts

### view-logs.sh
View logs in real-time with color-coded output.

```bash
# View all logs
./scripts/logs/view-logs.sh

# View specific log type
./scripts/logs/view-logs.sh [api|auth|db|error|sharing]

# View without following
./scripts/logs/view-logs.sh api false
```

### filter-logs.sh
Filter logs by various criteria.

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
```

### export-logs.sh
Export logs for external analysis.

```bash
# Export as JSON
./scripts/logs/export-logs.sh json today

# Export as CSV
./scripts/logs/export-logs.sh csv week

# Generate summary report
./scripts/logs/export-logs.sh summary month

# Generate detailed report
./scripts/logs/export-logs.sh report week
```

### analyze-performance.sh
Analyze API and database performance metrics.

```bash
# Analyze today's performance
./scripts/logs/analyze-performance.sh

# Analyze specific date
./scripts/logs/analyze-performance.sh 2025-06-15
```

## Log File Structure

Logs are stored in `/home/tnbt/todo-app/logs/` with the following naming convention:
- `app-YYYY-MM-DD.log` - All application logs
- `api-YYYY-MM-DD.log` - API request/response logs
- `auth-YYYY-MM-DD.log` - Authentication event logs
- `database-YYYY-MM-DD.log` - Database query logs
- `error-YYYY-MM-DD.log` - Error logs with stack traces
- `sharing-YYYY-MM-DD.log` - Task/category sharing logs

## Log Entry Format

Each log entry is a JSON object with the following structure:

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

## Common Use Cases

### Debug a failed request
```bash
# Find the request ID from error logs
./scripts/logs/filter-logs.sh error error

# Trace the entire request
./scripts/logs/filter-logs.sh all request "REQUEST_ID_HERE"
```

### Monitor performance issues
```bash
# Check today's performance metrics
./scripts/logs/analyze-performance.sh

# Find slow API endpoints
./scripts/logs/filter-logs.sh api | jq 'select(.duration > 1000)'
```

### Export logs for reporting
```bash
# Generate weekly report
./scripts/logs/export-logs.sh report week weekly-report.txt

# Export data for spreadsheet analysis
./scripts/logs/export-logs.sh csv month api-metrics.csv
```

## Tips

1. **Use request IDs** - Every API request has a unique ID that's propagated through all related logs
2. **Check multiple log types** - Errors often appear in multiple logs (api, error, auth)
3. **Export regularly** - Log files rotate daily, export important data for long-term storage
4. **Monitor performance** - Run performance analysis daily to catch degradation early
5. **Set up alerts** - Use filter scripts in cron jobs to alert on high error rates

## Troubleshooting

If logs aren't appearing:
1. Check the logs directory exists: `ls -la /home/tnbt/todo-app/logs/`
2. Verify the app is running: `docker ps`
3. Check app logs: `docker logs simple-todo-app`
4. Ensure proper permissions: `./scripts/init-logging.sh`