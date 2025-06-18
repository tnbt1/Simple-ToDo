#!/bin/bash

# Script to view logs in real-time with optional filtering

LOGS_DIR="${LOGS_DIR:-/home/tnbt/todo-app/logs}"
LOG_TYPE="${1:-all}"
FOLLOW="${2:-true}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
    echo "Usage: $0 [log-type] [follow]"
    echo ""
    echo "Log types:"
    echo "  all      - All logs (default)"
    echo "  api      - API request/response logs"
    echo "  auth     - Authentication logs"
    echo "  db       - Database query logs"
    echo "  error    - Error logs only"
    echo "  sharing  - Sharing event logs"
    echo ""
    echo "Follow options:"
    echo "  true     - Follow log updates (default)"
    echo "  false    - Show current logs and exit"
    echo ""
    echo "Examples:"
    echo "  $0              # View all logs in real-time"
    echo "  $0 api          # View API logs in real-time"
    echo "  $0 error false  # View current error logs"
    exit 1
}

# Check if logs directory exists
if [ ! -d "$LOGS_DIR" ]; then
    echo -e "${RED}Error: Logs directory not found at $LOGS_DIR${NC}"
    exit 1
fi

# Determine which log file to view
case "$LOG_TYPE" in
    all)
        LOG_FILE="$LOGS_DIR/app-$(date +%Y-%m-%d).log"
        echo -e "${CYAN}Viewing all logs...${NC}"
        ;;
    api)
        LOG_FILE="$LOGS_DIR/api-$(date +%Y-%m-%d).log"
        echo -e "${BLUE}Viewing API logs...${NC}"
        ;;
    auth)
        LOG_FILE="$LOGS_DIR/auth-$(date +%Y-%m-%d).log"
        echo -e "${GREEN}Viewing authentication logs...${NC}"
        ;;
    db|database)
        LOG_FILE="$LOGS_DIR/database-$(date +%Y-%m-%d).log"
        echo -e "${MAGENTA}Viewing database logs...${NC}"
        ;;
    error)
        LOG_FILE="$LOGS_DIR/error-$(date +%Y-%m-%d).log"
        echo -e "${RED}Viewing error logs...${NC}"
        ;;
    sharing)
        LOG_FILE="$LOGS_DIR/sharing-$(date +%Y-%m-%d).log"
        echo -e "${YELLOW}Viewing sharing logs...${NC}"
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        echo -e "${RED}Invalid log type: $LOG_TYPE${NC}"
        usage
        ;;
esac

# Check if log file exists
if [ ! -f "$LOG_FILE" ]; then
    echo -e "${YELLOW}Warning: Log file not found: $LOG_FILE${NC}"
    echo "No logs have been generated yet today."
    exit 0
fi

# View logs with jq for pretty JSON formatting
if [ "$FOLLOW" == "true" ]; then
    echo "Press Ctrl+C to stop following logs..."
    echo ""
    tail -f "$LOG_FILE" | while IFS= read -r line; do
        echo "$line" | jq -C '.' 2>/dev/null || echo "$line"
    done
else
    cat "$LOG_FILE" | jq -C '.' 2>/dev/null || cat "$LOG_FILE"
fi