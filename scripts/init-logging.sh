#!/bin/bash

# Script to initialize logging directory and permissions

LOGS_DIR="${LOGS_DIR:-/home/tnbt/todo-app/logs}"

echo "Initializing logging system..."

# Create logs directory if it doesn't exist
if [ ! -d "$LOGS_DIR" ]; then
    echo "Creating logs directory at $LOGS_DIR"
    mkdir -p "$LOGS_DIR"
    mkdir -p "$LOGS_DIR/exports"
fi

# Set proper permissions
chmod 755 "$LOGS_DIR"
chmod 755 "$LOGS_DIR/exports"

# Create initial log files with proper permissions
touch "$LOGS_DIR/app-$(date +%Y-%m-%d).log"
touch "$LOGS_DIR/api-$(date +%Y-%m-%d).log"
touch "$LOGS_DIR/auth-$(date +%Y-%m-%d).log"
touch "$LOGS_DIR/database-$(date +%Y-%m-%d).log"
touch "$LOGS_DIR/error-$(date +%Y-%m-%d).log"
touch "$LOGS_DIR/sharing-$(date +%Y-%m-%d).log"

# Set permissions for log files
chmod 644 "$LOGS_DIR"/*.log

echo "Logging system initialized successfully!"
echo ""
echo "Log files location: $LOGS_DIR"
echo "Available log types:"
echo "  - app-$(date +%Y-%m-%d).log     (All logs)"
echo "  - api-$(date +%Y-%m-%d).log     (API requests/responses)"
echo "  - auth-$(date +%Y-%m-%d).log    (Authentication events)"
echo "  - database-$(date +%Y-%m-%d).log (Database queries)"
echo "  - error-$(date +%Y-%m-%d).log   (Error logs)"
echo "  - sharing-$(date +%Y-%m-%d).log (Sharing events)"
echo ""
echo "Use ./scripts/logs/view-logs.sh to view logs in real-time"