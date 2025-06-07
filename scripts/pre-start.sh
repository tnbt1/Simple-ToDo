#!/bin/bash
# Pre-start script that runs before Docker Compose

set -e

echo "🚀 Pre-start setup for Todo App..."

# Create .env from example if it doesn't exist
if [ ! -f .env ]; then
    echo "📋 Creating .env file from .env.example..."
    cp .env.example .env
    echo "🔐 Generating secure secrets..."
    ./scripts/generate-secrets.sh > /dev/null 2>&1
    echo "✅ .env file created with secure secrets."
fi

# Check if NEXTAUTH_SECRET is still the default
if grep -q "your-secret-key-here-please-change-in-production" .env 2>/dev/null; then
    echo "⚠️  Default NEXTAUTH_SECRET detected. Generating secure secrets..."
    ./scripts/generate-secrets.sh > /dev/null 2>&1
    echo "✅ Updated with secure secrets."
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check Redis optimization settings
if [ "${REDIS_OPTIMIZE:-true}" = "true" ]; then
    echo "🔧 Checking Redis optimization settings..."
    
    # Check current vm.overcommit_memory setting
    current_setting=$(cat /proc/sys/vm/overcommit_memory 2>/dev/null || echo "unknown")
    
    if [ "$current_setting" != "1" ]; then
        echo "⚠️  Redis optimization required to prevent warnings"
        echo ""
        echo "🔧 vm.overcommit_memory is currently: $current_setting (should be 1)"
        echo ""
        echo "📋 To fix this, run on your HOST machine:"
        echo "   sudo ./scripts/docker-host-setup.sh"
        echo ""
        echo "💡 Or disable optimization with: REDIS_OPTIMIZE=false in .env"
        echo ""
        read -p "Continue with Redis warnings? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ Setup cancelled. Please run host optimizations first."
            echo "   sudo ./scripts/docker-host-setup.sh"
            exit 1
        fi
        echo "⚠️  Continuing with Redis warnings enabled..."
    else
        echo "✅ Redis optimization already applied (vm.overcommit_memory=1)"
    fi
else
    echo "⏭️  Redis optimization disabled (REDIS_OPTIMIZE=false)"
fi

echo "✅ Pre-start setup complete!"
echo "🐳 Ready to start Docker containers..."