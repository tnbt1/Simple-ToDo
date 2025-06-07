#!/bin/sh
set -e

echo "Starting application..."

# Wait for database to be ready
echo "Waiting for database..."
until nc -z postgres 5432; do
  echo "Database is unavailable - sleeping"
  sleep 1
done
echo "Database is ready!"

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Push database schema
echo "Pushing database schema..."
npx prisma db push --accept-data-loss

# Seed demo data (optional, ignore errors)
echo "Seeding demo data..."
npm run seed || echo "Demo data seeding failed or already exists"

# Start the application
echo "Starting Next.js application..."
exec node server.js