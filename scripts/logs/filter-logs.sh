#!/bin/bash

# Script to filter logs by various criteria

LOGS_DIR="${LOGS_DIR:-/home/tnbt/todo-app/logs}"
LOG_FILE="${1:-$LOGS_DIR/app-$(date +%Y-%m-%d).log}"
FILTER_TYPE="${2:-}"
FILTER_VALUE="${3:-}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Function to display usage
usage() {
    echo "Usage: $0 [log-file] [filter-type] [filter-value]"
    echo ""
    echo "Filter types:"
    echo "  level       - Filter by log level (error, warn, info, debug)"
    echo "  request     - Filter by request ID"
    echo "  user        - Filter by user ID"
    echo "  status      - Filter by HTTP status code"
    echo "  method      - Filter by HTTP method (GET, POST, etc.)"
    echo "  path        - Filter by API path"
    echo "  service     - Filter by service (api, auth, database, sharing)"
    echo "  time        - Filter logs within last N minutes"
    echo "  error       - Show only errors with stack traces"
    echo ""
    echo "Examples:"
    echo "  $0 app level error                    # Show only error logs"
    echo "  $0 api request abc123                 # Show logs for request ID abc123"
    echo "  $0 auth user user_123                 # Show auth logs for user_123"
    echo "  $0 api status 500                     # Show 500 errors"
    echo "  $0 all time 30                        # Show logs from last 30 minutes"
    echo ""
    echo "Log file shortcuts:"
    echo "  app, api, auth, db, error, sharing   # Use today's log file of that type"
    exit 1
}

# Helper function to resolve log file shortcuts
resolve_log_file() {
    case "$1" in
        app|all)
            echo "$LOGS_DIR/app-$(date +%Y-%m-%d).log"
            ;;
        api)
            echo "$LOGS_DIR/api-$(date +%Y-%m-%d).log"
            ;;
        auth)
            echo "$LOGS_DIR/auth-$(date +%Y-%m-%d).log"
            ;;
        db|database)
            echo "$LOGS_DIR/database-$(date +%Y-%m-%d).log"
            ;;
        error)
            echo "$LOGS_DIR/error-$(date +%Y-%m-%d).log"
            ;;
        sharing)
            echo "$LOGS_DIR/sharing-$(date +%Y-%m-%d).log"
            ;;
        *)
            echo "$1"
            ;;
    esac
}

# Resolve log file
LOG_FILE=$(resolve_log_file "$LOG_FILE")

# Check if log file exists
if [ ! -f "$LOG_FILE" ]; then
    echo -e "${RED}Error: Log file not found: $LOG_FILE${NC}"
    exit 1
fi

# If no filter specified, show usage
if [ -z "$FILTER_TYPE" ]; then
    usage
fi

# Apply filters based on type
case "$FILTER_TYPE" in
    level)
        echo -e "${CYAN}Filtering by log level: $FILTER_VALUE${NC}"
        cat "$LOG_FILE" | jq -c "select(.level == \"$FILTER_VALUE\")" | jq -C '.'
        ;;
    
    request)
        echo -e "${CYAN}Filtering by request ID: $FILTER_VALUE${NC}"
        cat "$LOG_FILE" | jq -c "select(.requestId == \"$FILTER_VALUE\")" | jq -C '.'
        ;;
    
    user)
        echo -e "${CYAN}Filtering by user ID: $FILTER_VALUE${NC}"
        cat "$LOG_FILE" | jq -c "select(.userId == \"$FILTER_VALUE\")" | jq -C '.'
        ;;
    
    status)
        echo -e "${CYAN}Filtering by status code: $FILTER_VALUE${NC}"
        cat "$LOG_FILE" | jq -c "select(.statusCode == $FILTER_VALUE)" | jq -C '.'
        ;;
    
    method)
        echo -e "${CYAN}Filtering by HTTP method: $FILTER_VALUE${NC}"
        cat "$LOG_FILE" | jq -c "select(.method == \"$FILTER_VALUE\")" | jq -C '.'
        ;;
    
    path)
        echo -e "${CYAN}Filtering by API path containing: $FILTER_VALUE${NC}"
        cat "$LOG_FILE" | jq -c "select(.path | contains(\"$FILTER_VALUE\"))" | jq -C '.'
        ;;
    
    service)
        echo -e "${CYAN}Filtering by service: $FILTER_VALUE${NC}"
        cat "$LOG_FILE" | jq -c "select(.service == \"$FILTER_VALUE\")" | jq -C '.'
        ;;
    
    time)
        if ! [[ "$FILTER_VALUE" =~ ^[0-9]+$ ]]; then
            echo -e "${RED}Error: Time value must be a number (minutes)${NC}"
            exit 1
        fi
        echo -e "${CYAN}Filtering logs from last $FILTER_VALUE minutes${NC}"
        CUTOFF_TIME=$(date -d "$FILTER_VALUE minutes ago" +%s)
        cat "$LOG_FILE" | while IFS= read -r line; do
            TIMESTAMP=$(echo "$line" | jq -r '.timestamp' 2>/dev/null)
            if [ ! -z "$TIMESTAMP" ]; then
                LOG_TIME=$(date -d "$TIMESTAMP" +%s 2>/dev/null)
                if [ ! -z "$LOG_TIME" ] && [ "$LOG_TIME" -ge "$CUTOFF_TIME" ]; then
                    echo "$line" | jq -C '.'
                fi
            fi
        done
        ;;
    
    error)
        echo -e "${RED}Filtering error logs with stack traces${NC}"
        cat "$LOG_FILE" | jq -c 'select(.level == "error" and .error.stack != null)' | jq -C '.'
        ;;
    
    help|--help|-h)
        usage
        ;;
    
    *)
        echo -e "${RED}Invalid filter type: $FILTER_TYPE${NC}"
        usage
        ;;
esac

# Show count of filtered results
echo ""
echo -e "${GREEN}Total matching logs: $(cat "$LOG_FILE" | jq -c "select(.${FILTER_TYPE} == \"$FILTER_VALUE\")" 2>/dev/null | wc -l)${NC}"