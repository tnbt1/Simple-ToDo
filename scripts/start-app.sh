#!/bin/bash
# Application startup script with database migration

set -e

echo "🚀 Starting Todo Application..."

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
while ! nc -z postgres 5432; do
    echo "🔄 PostgreSQL not ready yet, waiting..."
    sleep 2
done
echo "✅ PostgreSQL is ready!"

# Run Prisma migrations
echo "🗄️  Running database migrations..."
npx prisma migrate deploy

# Generate Prisma client (in case it's needed)
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run database seed if needed
echo "🌱 Checking if database seeding is needed..."
USER_COUNT=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) as count FROM \"User\";" 2>/dev/null | grep -o '[0-9]\+' | tail -1 || echo "0")

if [ "$USER_COUNT" = "0" ]; then
    echo "👤 No users found, running database seed..."
    npm run seed
    echo "✅ Database seeded with test user"
else
    echo "👥 Users already exist (count: $USER_COUNT), skipping seed"
fi

echo "🎉 Database setup complete!"
echo "🚀 Starting Next.js application..."

# Start the application
exec node server.js