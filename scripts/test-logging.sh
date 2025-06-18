#!/bin/bash

# Script to test the logging system

echo "Testing Todo App Logging System"
echo "=============================="
echo ""

# Initialize logging
./scripts/init-logging.sh

echo ""
echo "Starting log viewers in background..."
echo ""

# Function to test API endpoints
test_endpoint() {
    local method=$1
    local url=$2
    local data=$3
    local description=$4
    
    echo "Testing: $description"
    if [ "$method" == "GET" ]; then
        curl -s -X GET "$url" -H "Content-Type: application/json" > /dev/null 2>&1
    else
        curl -s -X "$method" "$url" -H "Content-Type: application/json" -d "$data" > /dev/null 2>&1
    fi
    echo "✓ Request sent"
    sleep 1
}

# Test various endpoints to generate logs
echo ""
echo "Generating test logs..."
echo "----------------------"

# Test authentication
test_endpoint "POST" "http://localhost:3100/api/auth/register" \
    '{"name":"Test Logger","email":"logger@test.com","password":"test123"}' \
    "User registration (auth log)"

# Test login failure
test_endpoint "POST" "http://localhost:3100/api/auth/signin" \
    '{"email":"wrong@test.com","password":"wrongpass"}' \
    "Failed login attempt (auth + error log)"

# Test API without auth
test_endpoint "GET" "http://localhost:3100/api/tasks" "" \
    "Unauthorized API request (api + error log)"

# Test invalid JSON
test_endpoint "POST" "http://localhost:3100/api/tasks" \
    'invalid json data' \
    "Invalid JSON request (error log)"

echo ""
echo "Test logs generated!"
echo ""
echo "View logs using:"
echo "  ./scripts/logs/view-logs.sh all     # All logs"
echo "  ./scripts/logs/view-logs.sh api     # API logs"
echo "  ./scripts/logs/view-logs.sh auth    # Auth logs"
echo "  ./scripts/logs/view-logs.sh error   # Error logs"
echo ""
echo "Filter logs using:"
echo "  ./scripts/logs/filter-logs.sh api level error"
echo "  ./scripts/logs/filter-logs.sh all time 5"
echo ""
echo "Analyze performance:"
echo "  ./scripts/logs/analyze-performance.sh"
echo ""
echo "Export logs:"
echo "  ./scripts/logs/export-logs.sh json today"
echo "  ./scripts/logs/export-logs.sh summary today"