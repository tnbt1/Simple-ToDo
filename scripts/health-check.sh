#!/bin/bash
# Health check script for Todo App

set -e

echo "🏥 Todo App Health Check"
echo "========================"

# Check if containers are running
echo "🐳 Checking container status..."
if ! docker compose ps | grep -q "Up"; then
    echo "❌ Containers are not running"
    echo "💡 Try: docker compose up -d"
    exit 1
fi

# Check each service
echo "📊 Service Status:"
docker compose ps

echo ""
echo "🔍 Detailed Health Checks:"

# Check PostgreSQL
echo "🗄️  PostgreSQL:"
if docker compose exec postgres pg_isready -U todouser -d todoapp > /dev/null 2>&1; then
    echo "  ✅ Database is ready"
else
    echo "  ❌ Database connection failed"
fi

# Check Redis
echo "🔴 Redis:"
if docker compose exec redis redis-cli ping > /dev/null 2>&1; then
    echo "  ✅ Redis is responding"
else
    echo "  ❌ Redis connection failed"
fi

# Check Application
echo "🌐 Application:"
if curl -s http://localhost:3100 > /dev/null 2>&1; then
    echo "  ✅ Application is responding on port 3100"
else
    echo "  ❌ Application is not responding"
fi

# Check for errors in logs
echo ""
echo "🔍 Recent Error Check:"
if docker compose logs app --tail 50 | grep -i "error\|failed\|fatal" > /dev/null 2>&1; then
    echo "⚠️  Recent errors found in application logs:"
    docker compose logs app --tail 10 | grep -i "error\|failed\|fatal"
else
    echo "✅ No recent errors detected"
fi

echo ""
echo "🏁 Health check complete!"