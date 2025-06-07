#!/bin/bash
# Debug script to check user creation and database status

echo "🔍 Checking user database..."
echo "=============================="

# Check if containers are running
if ! docker compose ps | grep -q "Up"; then
    echo "❌ Containers not running. Please start with: docker compose up -d"
    exit 1
fi

# Check database connection
echo "🔗 Testing database connection..."
if docker compose exec postgres pg_isready -U todouser -d todoapp > /dev/null 2>&1; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    exit 1
fi

# Show users in database
echo ""
echo "👥 Users in database:"
echo "====================="
docker compose exec postgres psql -U todouser -d todoapp -c "SELECT id, email, name, username, \"createdAt\" FROM \"User\";"

echo ""
echo "📊 User statistics:"
echo "=================="
user_count=$(docker compose exec postgres psql -U todouser -d todoapp -t -c "SELECT COUNT(*) FROM \"User\";" | xargs)
echo "Total users: $user_count"

echo ""
echo "🔧 To create a new user, visit:"
echo "http://localhost:3000/auth/signup"