#!/bin/sh
# Optimized startup script for production containers
set -e

echo "Starting optimized application..."

# Start the application directly with Node.js (no Prisma operations)
echo "Starting Next.js application..."
exec node server.js