#!/bin/bash
# Fix NextAuth JWT session errors

set -e

echo "🔧 Fixing NextAuth JWT session errors..."

# Stop containers
echo "🛑 Stopping containers..."
docker compose down

# Remove any existing JWT tokens/sessions
echo "🧹 Cleaning up browser data and Docker volumes..."
echo "📋 Please clear your browser cookies/localStorage for localhost:3000"

# Restart with clean state
echo "🚀 Starting containers with new secrets..."
docker compose up -d

echo ""
echo "✅ NextAuth JWT error fix applied!"
echo ""
echo "🌐 Access the application at: http://localhost:3000"
echo "🧹 Important: Clear your browser cache/cookies for localhost:3000"
echo "📊 New login will use the updated NEXTAUTH_SECRET"
echo ""
echo "🔍 To verify the fix:"
echo "   docker compose logs app | grep -i nextauth"