#!/bin/bash
# Reset database with new password

set -e

echo "🔄 Resetting database with new credentials..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo "🛑 Stopping all containers..."
docker compose down

echo "🗄️  Removing database volume (this will delete all data)..."
docker volume rm todo-app_postgres_data 2>/dev/null || true

echo "🚀 Starting containers with new credentials..."
docker compose up -d

echo "⏳ Waiting for database to initialize..."
sleep 15

echo "✅ Database reset complete!"
echo ""
echo "📊 New credentials:"
echo "   Database: ${POSTGRES_DB}"
echo "   Username: ${POSTGRES_USER}"
echo "   Password: ${POSTGRES_PASSWORD}"
echo ""
echo "🌐 Access the application at: http://localhost:3000"
echo "👤 Create a new account at: http://localhost:3000/auth/signup"