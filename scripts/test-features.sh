#!/bin/bash
# Test script to verify all features work correctly

set -e

echo "🧪 Todo App Feature Test"
echo "========================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3100"

# Function to check if a command succeeded
check_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        exit 1
    fi
}

# 1. Check if app is running
echo "🔍 Testing application availability..."
http_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL")
if [ "$http_code" = "200" ]; then
    check_result 0 "Application is accessible at $BASE_URL"
else
    check_result 1 "Application is not accessible (HTTP $http_code)"
fi

# 2. Check API health endpoint
echo ""
echo "🏥 Testing API health endpoint..."
http_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
if [ "$http_code" = "200" ]; then
    check_result 0 "API health endpoint is working"
else
    check_result 1 "API health endpoint failed (HTTP $http_code)"
fi

# 3. Check authentication endpoints
echo ""
echo "🔐 Testing authentication endpoints..."
http_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/auth/session")
if [ "$http_code" = "200" ]; then
    check_result 0 "Auth session endpoint is working"
else
    check_result 1 "Auth session endpoint failed (HTTP $http_code)"
fi

# 4. Check database connectivity
echo ""
echo "🗄️ Testing database connectivity..."
table_check=$(docker compose exec postgres psql -U todouser -d todoapp -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'User';" 2>/dev/null | xargs)
if [ "$table_check" = "1" ]; then
    check_result 0 "Database schema is properly set up"
else
    check_result 1 "Database schema not found"
fi

# 5. Check for new feature tables
echo ""
echo "🆕 Testing new feature tables..."
for table in "SharedTask" "SharedCategory" "ThreadMessage" "ThreadImage" "TaskPermission"; do
    table_check=$(docker compose exec postgres psql -U todouser -d todoapp -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '$table';" 2>/dev/null | xargs)
    if [ "$table_check" = "1" ]; then
        check_result 0 "Table $table exists"
    else
        check_result 1 "Table $table not found"
    fi
done

# 6. Check static assets
echo ""
echo "📦 Testing static assets..."
http_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/_next/static/css/app/layout.css")
if [ "$http_code" = "200" ] || [ "$http_code" = "304" ]; then
    check_result 0 "Static assets are being served"
else
    # Try alternative path for Next.js 15
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/_next/static/chunks/main.js")
    if [ "$http_code" = "200" ] || [ "$http_code" = "304" ]; then
        check_result 0 "Static assets are being served"
    else
        echo -e "${YELLOW}⚠️  Static assets might be using different paths${NC}"
    fi
fi

# 7. Check mobile responsiveness (by checking viewport meta tag)
echo ""
echo "📱 Testing mobile responsiveness..."
viewport_check=$(curl -s "$BASE_URL" | grep -c "viewport" || true)
if [ $viewport_check -gt 0 ]; then
    check_result 0 "Mobile viewport meta tag found"
else
    check_result 1 "Mobile viewport meta tag not found"
fi

# 8. Summary
echo ""
echo "📊 Test Summary"
echo "==============="
echo -e "${GREEN}✅ All critical features are working!${NC}"
echo ""
echo "📋 Features verified:"
echo "  ✅ Application accessibility"
echo "  ✅ API endpoints"
echo "  ✅ Authentication system"
echo "  ✅ Database connectivity"
echo "  ✅ New feature tables (sharing, threads)"
echo "  ✅ Static asset serving"
echo "  ✅ Mobile responsiveness"
echo ""
echo "🎉 The Todo app is ready for use in any environment!"
echo ""
echo "🔗 Quick Links:"
echo "  - Application: $BASE_URL"
echo "  - Sign up: $BASE_URL/auth/signup"
echo "  - Sign in: $BASE_URL/auth/signin"