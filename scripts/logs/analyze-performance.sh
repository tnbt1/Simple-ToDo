#!/bin/bash

# Script to analyze performance metrics from logs

LOGS_DIR="${LOGS_DIR:-/home/tnbt/todo-app/logs}"
DATE="${1:-$(date +%Y-%m-%d)}"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

echo -e "${CYAN}Performance Analysis for $DATE${NC}"
echo "======================================"
echo ""

# Check if API log exists
API_LOG="$LOGS_DIR/api-$DATE.log"
DB_LOG="$LOGS_DIR/database-$DATE.log"

if [ ! -f "$API_LOG" ]; then
    echo -e "${YELLOW}No API logs found for $DATE${NC}"
    exit 1
fi

# API Performance Metrics
echo -e "${GREEN}API Performance Metrics${NC}"
echo "----------------------"

# Total requests
TOTAL_REQUESTS=$(cat "$API_LOG" | jq -r 'select(.type == "api_response")' | wc -l)
echo "Total API Requests: $TOTAL_REQUESTS"

# Success vs Error rates
SUCCESS_COUNT=$(cat "$API_LOG" | jq -r 'select(.type == "api_response" and .statusCode < 400)' | wc -l)
ERROR_COUNT=$(cat "$API_LOG" | jq -r 'select(.type == "api_response" and .statusCode >= 400)' | wc -l)

if [ $TOTAL_REQUESTS -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=2; $SUCCESS_COUNT * 100 / $TOTAL_REQUESTS" | bc)
    ERROR_RATE=$(echo "scale=2; $ERROR_COUNT * 100 / $TOTAL_REQUESTS" | bc)
    echo "Success Rate: ${SUCCESS_RATE}%"
    echo -e "${RED}Error Rate: ${ERROR_RATE}%${NC}"
fi

echo ""

# Response time analysis
echo -e "${MAGENTA}Response Time Analysis${NC}"
echo "---------------------"

# Calculate percentiles
RESPONSE_TIMES=$(cat "$API_LOG" | jq -r 'select(.duration != null) | .duration' | sort -n)

if [ ! -z "$RESPONSE_TIMES" ]; then
    COUNT=$(echo "$RESPONSE_TIMES" | wc -l)
    
    # Average
    AVG=$(echo "$RESPONSE_TIMES" | awk '{sum+=$1} END {print sum/NR}')
    echo "Average Response Time: ${AVG} ms"
    
    # Median (50th percentile)
    MEDIAN=$(echo "$RESPONSE_TIMES" | awk "NR==int($COUNT/2)+1")
    echo "Median Response Time: ${MEDIAN} ms"
    
    # 95th percentile
    P95_INDEX=$(echo "scale=0; $COUNT * 0.95 / 1" | bc)
    P95=$(echo "$RESPONSE_TIMES" | sed -n "${P95_INDEX}p")
    echo "95th Percentile: ${P95} ms"
    
    # 99th percentile
    P99_INDEX=$(echo "scale=0; $COUNT * 0.99 / 1" | bc)
    P99=$(echo "$RESPONSE_TIMES" | sed -n "${P99_INDEX}p")
    echo "99th Percentile: ${P99} ms"
    
    # Min/Max
    MIN=$(echo "$RESPONSE_TIMES" | head -1)
    MAX=$(echo "$RESPONSE_TIMES" | tail -1)
    echo "Min Response Time: ${MIN} ms"
    echo "Max Response Time: ${MAX} ms"
fi

echo ""

# Slowest endpoints
echo -e "${YELLOW}Slowest Endpoints${NC}"
echo "-----------------"
cat "$API_LOG" | jq -r 'select(.duration != null) | "\(.duration)ms - \(.method) \(.path)"' | sort -rn | head -10

echo ""

# Most frequent endpoints
echo -e "${GREEN}Most Frequent Endpoints${NC}"
echo "----------------------"
cat "$API_LOG" | jq -r 'select(.type == "api_request") | "\(.method) \(.path)"' | sort | uniq -c | sort -rn | head -10

echo ""

# Error analysis
echo -e "${RED}Error Analysis${NC}"
echo "--------------"

# Status code distribution
echo "HTTP Status Code Distribution:"
cat "$API_LOG" | jq -r 'select(.statusCode != null) | .statusCode' | sort | uniq -c | sort -rn

echo ""

# Most common errors
echo "Most Common Errors:"
cat "$API_LOG" | jq -r 'select(.statusCode >= 400) | "\(.statusCode) - \(.method) \(.path)"' | sort | uniq -c | sort -rn | head -10

echo ""

# Database Performance (if available)
if [ -f "$DB_LOG" ]; then
    echo -e "${CYAN}Database Performance Metrics${NC}"
    echo "---------------------------"
    
    # Total queries
    TOTAL_QUERIES=$(cat "$DB_LOG" | wc -l)
    echo "Total Database Queries: $TOTAL_QUERIES"
    
    # Query time analysis
    DB_TIMES=$(cat "$DB_LOG" | jq -r '.duration' | sort -n)
    if [ ! -z "$DB_TIMES" ]; then
        DB_AVG=$(echo "$DB_TIMES" | awk '{sum+=$1} END {print sum/NR}')
        echo "Average Query Time: ${DB_AVG} ms"
        
        # Slowest queries
        echo ""
        echo "Slowest Database Operations:"
        cat "$DB_LOG" | jq -r '"\(.duration)ms - \(.operation) on \(.model)"' | sort -rn | head -10
    fi
    
    echo ""
    
    # Most frequent operations
    echo "Most Frequent Database Operations:"
    cat "$DB_LOG" | jq -r '"\(.operation) on \(.model)"' | sort | uniq -c | sort -rn | head -10
fi

echo ""

# Time-based analysis
echo -e "${MAGENTA}Hourly Request Distribution${NC}"
echo "--------------------------"
cat "$API_LOG" | jq -r '.timestamp' | cut -d'T' -f2 | cut -d':' -f1 | sort | uniq -c | sort -k2n | awk '{print $2":00 - "$1" requests"}'

echo ""

# Recommendations
echo -e "${GREEN}Performance Recommendations${NC}"
echo "--------------------------"

if [ ! -z "$P95" ] && [ $(echo "$P95 > 1000" | bc) -eq 1 ]; then
    echo -e "${YELLOW}⚠ High 95th percentile response time (${P95}ms). Consider optimizing slow endpoints.${NC}"
fi

if [ ! -z "$ERROR_RATE" ] && [ $(echo "$ERROR_RATE > 5" | bc) -eq 1 ]; then
    echo -e "${RED}⚠ High error rate (${ERROR_RATE}%). Investigate error logs for issues.${NC}"
fi

if [ ! -z "$DB_AVG" ] && [ $(echo "$DB_AVG > 100" | bc) -eq 1 ]; then
    echo -e "${YELLOW}⚠ High average database query time (${DB_AVG}ms). Consider query optimization.${NC}"
fi

echo ""
echo -e "${CYAN}Analysis complete!${NC}"