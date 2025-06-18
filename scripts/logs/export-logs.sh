#!/bin/bash

# Script to export logs for analysis

LOGS_DIR="${LOGS_DIR:-/home/tnbt/todo-app/logs}"
EXPORT_DIR="${EXPORT_DIR:-/home/tnbt/todo-app/logs/exports}"
EXPORT_FORMAT="${1:-json}"
DATE_RANGE="${2:-today}"
OUTPUT_FILE="${3:-}"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Function to display usage
usage() {
    echo "Usage: $0 [format] [date-range] [output-file]"
    echo ""
    echo "Formats:"
    echo "  json    - Export as JSON (default)"
    echo "  csv     - Export as CSV"
    echo "  summary - Export summary statistics"
    echo "  report  - Generate detailed report"
    echo ""
    echo "Date ranges:"
    echo "  today   - Today's logs only (default)"
    echo "  week    - Last 7 days"
    echo "  month   - Last 30 days"
    echo "  all     - All available logs"
    echo "  YYYY-MM-DD - Specific date"
    echo ""
    echo "Examples:"
    echo "  $0                           # Export today's logs as JSON"
    echo "  $0 csv week                  # Export last week as CSV"
    echo "  $0 summary month report.txt  # Generate monthly summary"
    echo "  $0 json 2025-06-15          # Export specific date"
    exit 1
}

# Create export directory if it doesn't exist
mkdir -p "$EXPORT_DIR"

# Determine date range
case "$DATE_RANGE" in
    today)
        START_DATE=$(date +%Y-%m-%d)
        END_DATE=$(date +%Y-%m-%d)
        ;;
    week)
        START_DATE=$(date -d "7 days ago" +%Y-%m-%d)
        END_DATE=$(date +%Y-%m-%d)
        ;;
    month)
        START_DATE=$(date -d "30 days ago" +%Y-%m-%d)
        END_DATE=$(date +%Y-%m-%d)
        ;;
    all)
        START_DATE="2000-01-01"
        END_DATE=$(date +%Y-%m-%d)
        ;;
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9])
        START_DATE="$DATE_RANGE"
        END_DATE="$DATE_RANGE"
        ;;
    *)
        echo -e "${RED}Invalid date range: $DATE_RANGE${NC}"
        usage
        ;;
esac

# Generate output filename if not provided
if [ -z "$OUTPUT_FILE" ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    case "$EXPORT_FORMAT" in
        json)
            OUTPUT_FILE="$EXPORT_DIR/logs_${DATE_RANGE}_${TIMESTAMP}.json"
            ;;
        csv)
            OUTPUT_FILE="$EXPORT_DIR/logs_${DATE_RANGE}_${TIMESTAMP}.csv"
            ;;
        summary|report)
            OUTPUT_FILE="$EXPORT_DIR/logs_${DATE_RANGE}_${TIMESTAMP}_report.txt"
            ;;
    esac
else
    OUTPUT_FILE="$EXPORT_DIR/$OUTPUT_FILE"
fi

# Function to collect logs from date range
collect_logs() {
    local temp_file=$(mktemp)
    
    # Iterate through date range
    current_date="$START_DATE"
    while [[ "$current_date" <= "$END_DATE" ]]; do
        for log_type in app api auth database error sharing; do
            log_file="$LOGS_DIR/${log_type}-${current_date}.log"
            if [ -f "$log_file" ]; then
                cat "$log_file" >> "$temp_file"
            fi
        done
        current_date=$(date -d "$current_date + 1 day" +%Y-%m-%d)
    done
    
    echo "$temp_file"
}

# Export based on format
case "$EXPORT_FORMAT" in
    json)
        echo -e "${CYAN}Exporting logs as JSON...${NC}"
        TEMP_FILE=$(collect_logs)
        
        # Create proper JSON array
        echo "[" > "$OUTPUT_FILE"
        cat "$TEMP_FILE" | jq -c '.' | paste -sd ',' >> "$OUTPUT_FILE"
        echo "]" >> "$OUTPUT_FILE"
        
        # Pretty print the JSON
        jq '.' "$OUTPUT_FILE" > "${OUTPUT_FILE}.tmp" && mv "${OUTPUT_FILE}.tmp" "$OUTPUT_FILE"
        
        rm -f "$TEMP_FILE"
        echo -e "${GREEN}Exported to: $OUTPUT_FILE${NC}"
        ;;
    
    csv)
        echo -e "${CYAN}Exporting logs as CSV...${NC}"
        TEMP_FILE=$(collect_logs)
        
        # Create CSV header
        echo "timestamp,level,service,message,requestId,userId,method,path,statusCode,duration" > "$OUTPUT_FILE"
        
        # Convert JSON to CSV
        cat "$TEMP_FILE" | jq -r '
            [.timestamp, .level, .service // "", .message, 
             .requestId // "", .userId // "", .method // "", 
             .path // "", .statusCode // "", .duration // ""] 
            | @csv' >> "$OUTPUT_FILE"
        
        rm -f "$TEMP_FILE"
        echo -e "${GREEN}Exported to: $OUTPUT_FILE${NC}"
        ;;
    
    summary)
        echo -e "${CYAN}Generating summary statistics...${NC}"
        TEMP_FILE=$(collect_logs)
        
        cat > "$OUTPUT_FILE" << EOF
Log Analysis Summary Report
Generated: $(date)
Date Range: $START_DATE to $END_DATE

=== Overall Statistics ===
EOF
        
        # Total logs
        echo "Total Log Entries: $(cat "$TEMP_FILE" | wc -l)" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        
        # Logs by level
        echo "=== Logs by Level ===" >> "$OUTPUT_FILE"
        cat "$TEMP_FILE" | jq -r '.level' | sort | uniq -c | sort -rn >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        
        # Logs by service
        echo "=== Logs by Service ===" >> "$OUTPUT_FILE"
        cat "$TEMP_FILE" | jq -r '.service // "unknown"' | sort | uniq -c | sort -rn >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        
        # API Statistics
        echo "=== API Statistics ===" >> "$OUTPUT_FILE"
        echo "Total API Requests: $(cat "$TEMP_FILE" | jq -r 'select(.type == "api_request")' | wc -l)" >> "$OUTPUT_FILE"
        echo "Average Response Time: $(cat "$TEMP_FILE" | jq -r 'select(.duration != null) | .duration' | awk '{sum+=$1; count++} END {if(count>0) print sum/count " ms"; else print "N/A"}')" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        
        # Status codes
        echo "=== HTTP Status Codes ===" >> "$OUTPUT_FILE"
        cat "$TEMP_FILE" | jq -r 'select(.statusCode != null) | .statusCode' | sort | uniq -c | sort -rn >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        
        # Top errors
        echo "=== Top Errors ===" >> "$OUTPUT_FILE"
        cat "$TEMP_FILE" | jq -r 'select(.level == "error") | .message' | sort | uniq -c | sort -rn | head -10 >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        
        # Most active users
        echo "=== Most Active Users ===" >> "$OUTPUT_FILE"
        cat "$TEMP_FILE" | jq -r 'select(.userId != null) | .userId' | sort | uniq -c | sort -rn | head -10 >> "$OUTPUT_FILE"
        
        rm -f "$TEMP_FILE"
        echo -e "${GREEN}Summary exported to: $OUTPUT_FILE${NC}"
        ;;
    
    report)
        echo -e "${CYAN}Generating detailed report...${NC}"
        TEMP_FILE=$(collect_logs)
        
        # Generate comprehensive report
        cat > "$OUTPUT_FILE" << EOF
Comprehensive Log Analysis Report
=================================
Generated: $(date)
Date Range: $START_DATE to $END_DATE

Executive Summary
-----------------
EOF
        
        # Key metrics
        TOTAL_LOGS=$(cat "$TEMP_FILE" | wc -l)
        ERROR_COUNT=$(cat "$TEMP_FILE" | jq -r 'select(.level == "error")' | wc -l)
        ERROR_RATE=$(echo "scale=2; $ERROR_COUNT * 100 / $TOTAL_LOGS" | bc 2>/dev/null || echo "0")
        
        cat >> "$OUTPUT_FILE" << EOF
Total Log Entries: $TOTAL_LOGS
Error Count: $ERROR_COUNT
Error Rate: ${ERROR_RATE}%

Performance Metrics
-------------------
EOF
        
        # API performance
        AVG_RESPONSE=$(cat "$TEMP_FILE" | jq -r 'select(.duration != null) | .duration' | awk '{sum+=$1; count++} END {if(count>0) print sum/count; else print "0"}')
        MAX_RESPONSE=$(cat "$TEMP_FILE" | jq -r 'select(.duration != null) | .duration' | sort -n | tail -1)
        MIN_RESPONSE=$(cat "$TEMP_FILE" | jq -r 'select(.duration != null) | .duration' | sort -n | head -1)
        
        echo "Average API Response Time: ${AVG_RESPONSE} ms" >> "$OUTPUT_FILE"
        echo "Maximum API Response Time: ${MAX_RESPONSE} ms" >> "$OUTPUT_FILE"
        echo "Minimum API Response Time: ${MIN_RESPONSE} ms" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        
        # Detailed sections
        echo "Authentication Events" >> "$OUTPUT_FILE"
        echo "--------------------" >> "$OUTPUT_FILE"
        cat "$TEMP_FILE" | jq -r 'select(.service == "auth") | "\(.timestamp) - \(.event // .message) - User: \(.userId // "N/A")"' | head -20 >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        
        echo "Sharing Events" >> "$OUTPUT_FILE"
        echo "--------------" >> "$OUTPUT_FILE"
        cat "$TEMP_FILE" | jq -r 'select(.service == "sharing") | "\(.timestamp) - \(.event) - \(.resourceType): \(.resourceId)"' | head -20 >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        
        echo "Recent Errors" >> "$OUTPUT_FILE"
        echo "-------------" >> "$OUTPUT_FILE"
        cat "$TEMP_FILE" | jq -r 'select(.level == "error") | "\(.timestamp) - \(.message)\n  Context: \(.context // "N/A")\n  Stack: \(.error.stack // "N/A" | split("\n")[0])"' | head -10 >> "$OUTPUT_FILE"
        
        rm -f "$TEMP_FILE"
        echo -e "${GREEN}Detailed report exported to: $OUTPUT_FILE${NC}"
        ;;
    
    help|--help|-h)
        usage
        ;;
    
    *)
        echo -e "${RED}Invalid format: $EXPORT_FORMAT${NC}"
        usage
        ;;
esac

# Show file size
if [ -f "$OUTPUT_FILE" ]; then
    FILE_SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')
    echo -e "${YELLOW}File size: $FILE_SIZE${NC}"
fi