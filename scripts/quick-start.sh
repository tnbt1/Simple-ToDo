#!/bin/bash
# Complete Quick Start Setup for Todo App

set -e

echo "🚀 Todo App Complete Quick Start"
echo "================================="
echo ""

# Check if Docker is running
echo "🔍 Checking prerequisites..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version > /dev/null 2>&1; then
    echo "❌ Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

echo "✅ Docker and Docker Compose are available"
echo ""

# 1. Environment File Setup
echo "📋 Step 1: Environment Configuration"
echo "====================================="

if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
else
    echo "📄 .env file already exists"
fi

# 2. Security Keys Generation
echo ""
echo "🔐 Step 2: Security Keys"
echo "========================"

# Check if keys are default
needs_keys=false
if grep -q "your-secret-key-here-please-change-in-production" .env 2>/dev/null; then
    needs_keys=true
fi
if grep -q "your-secure-password-change-me" .env 2>/dev/null; then
    needs_keys=true
fi

if [ "$needs_keys" = true ]; then
    echo "⚠️  Default security keys detected!"
    echo "🔒 Secure keys are required for:"
    echo "   - NextAuth.js JWT encryption"
    echo "   - Database authentication"
    echo "   - Session security"
    echo ""
    read -p "🔑 Generate new secure keys? (Y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        echo "⚠️  Continuing with default keys (NOT RECOMMENDED for production)"
    else
        echo "🔐 Generating cryptographically secure keys..."
        ./scripts/generate-secrets.sh > /dev/null 2>&1
        echo "✅ Secure keys generated successfully!"
    fi
else
    echo "✅ Secure keys are already configured"
fi

# 3. System Optimization
echo ""
echo "🔧 Step 3: System Optimization"
echo "==============================="

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

if [ "${REDIS_OPTIMIZE:-true}" = "true" ]; then
    current_setting=$(cat /proc/sys/vm/overcommit_memory 2>/dev/null || echo "unknown")
    
    if [ "$current_setting" != "1" ]; then
        echo "🔧 Redis optimization needed (vm.overcommit_memory=$current_setting)"
        echo "📋 This will eliminate Redis memory warnings"
        echo ""
        read -p "🚀 Apply system optimizations? (Y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Nn]$ ]]; then
            echo "⏭️  Skipping optimization (Redis warnings will appear)"
        else
            echo "🔑 System optimization requires sudo privileges..."
            if sudo -n true 2>/dev/null; then
                echo "🔧 Applying optimizations..."
                sudo ./scripts/docker-host-setup.sh
            else
                echo "🔐 Please enter your password for system optimization:"
                sudo ./scripts/docker-host-setup.sh
            fi
        fi
    else
        echo "✅ System optimizations already applied"
    fi
else
    echo "⏭️  Redis optimization disabled in configuration"
fi

echo ""
echo "🧹 Step 4: Clean Start"
echo "======================"

# Check if containers are already running
if docker compose ps | grep -q "Up"; then
    echo "🔄 Existing containers detected"
    read -p "🗑️  Stop and restart containers for clean setup? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo "🛑 Stopping existing containers..."
        docker compose down
        
        # Ask about data reset if keys were regenerated
        if [ "$needs_keys" = true ] && [[ ! $REPLY =~ ^[Nn]$ ]]; then
            echo ""
            echo "💾 Database credentials were updated"
            read -p "🗄️  Reset database for new credentials? (Y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Nn]$ ]]; then
                echo "🗑️  Removing old database volume..."
                docker volume rm simple-todo_postgres_data 2>/dev/null || true
                echo "✅ Database will be recreated with new credentials"
            fi
        fi
    fi
fi

echo ""
echo "🚀 Step 5: Starting Application"
echo "==============================="

# Check for potential PostgreSQL authentication issues
echo "🔍 Checking for potential database conflicts..."
existing_volumes=$(docker volume ls -q | grep postgres_data || true)
if [ ! -z "$existing_volumes" ]; then
    echo "⚠️  Existing PostgreSQL volumes detected:"
    echo "$existing_volumes"
    echo ""
    echo "💡 This can cause authentication errors if passwords don't match"
    read -p "🗑️  Remove existing PostgreSQL volumes to prevent auth errors? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        echo "🗑️  Removing existing PostgreSQL volumes..."
        echo "$existing_volumes" | xargs -r docker volume rm
        echo "✅ PostgreSQL volumes cleaned"
    fi
fi

# Start the application
echo "🐳 Starting Docker containers..."
docker compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 20

echo ""
echo "🔍 Step 6: Health Check"
echo "======================="

# Check service status
echo "📊 Container Status:"
docker compose ps

# Check for startup errors
echo ""
echo "🔍 Checking for startup errors..."
startup_errors=false

# Check application logs
if docker compose logs app --tail 30 | grep -i "error\|failed\|fatal" > /dev/null 2>&1; then
    echo "⚠️  Application errors detected:"
    docker compose logs app --tail 10 | grep -i "error\|failed\|fatal"
    startup_errors=true
fi

# Check database connectivity
echo "🗄️  Testing database connection..."
if docker compose exec postgres pg_isready -U todouser -d todoapp > /dev/null 2>&1; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    
    # Check for authentication errors in PostgreSQL logs
    echo "🔍 Checking for authentication errors..."
    if docker compose logs postgres 2>/dev/null | grep -i "password authentication failed" > /dev/null 2>&1; then
        echo "⚠️  PostgreSQL authentication error detected!"
        echo "🔧 This is usually caused by existing volumes with different credentials"
        echo ""
        read -p "🛠️  Automatically fix by resetting PostgreSQL volume? (Y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            echo "🛑 Stopping containers..."
            docker compose down
            echo "🗑️  Removing PostgreSQL volume..."
            docker volume rm simple-todo_postgres_data 2>/dev/null || true
            echo "🚀 Restarting with clean database..."
            docker compose up -d
            echo "⏳ Waiting for database to initialize..."
            sleep 30
            
            # Test connection again
            if docker compose exec postgres pg_isready -U todouser -d todoapp > /dev/null 2>&1; then
                echo "✅ Database connection restored!"
            else
                echo "❌ Database connection still failed"
                startup_errors=true
            fi
        else
            startup_errors=true
        fi
    else
        startup_errors=true
    fi
fi

# Check Redis
echo "🔴 Testing Redis connection..."
if docker compose exec redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis connection successful"
else
    echo "❌ Redis connection failed"
    startup_errors=true
fi

# Check database tables (migration verification)
echo "🗄️  Verifying database migrations..."
table_check=$(docker compose exec postgres psql -U todouser -d todoapp -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'User';" 2>/dev/null | xargs)
if [ "$table_check" = "1" ]; then
    echo "✅ Database migrations completed successfully"
else
    echo "❌ Database migrations failed - User table not found"
    echo "🔧 This usually means Prisma migrations didn't run"
    startup_errors=true
fi

# Check test user creation
echo "👤 Verifying test user creation..."
sleep 2  # Wait for seed to complete
user_check=$(docker compose exec postgres psql -U todouser -d todoapp -t -c 'SELECT COUNT(*) FROM "User" WHERE email = '\''test@example.com'\'';' 2>/dev/null | xargs)
if [ "$user_check" = "1" ]; then
    echo "✅ Test user (test@example.com) is available"
else
    echo "⚠️  Test user not found, creating manually..."
    docker compose exec app npm run seed > /dev/null 2>&1
    # Verify again
    user_check_retry=$(docker compose exec postgres psql -U todouser -d todoapp -t -c 'SELECT COUNT(*) FROM "User" WHERE email = '\''test@example.com'\'';' 2>/dev/null | xargs)
    if [ "$user_check_retry" = "1" ]; then
        echo "✅ Test user created successfully"
    else
        echo "❌ Failed to create test user"
        startup_errors=true
    fi
fi

# Verify application is responding
echo "🌐 Testing application response..."
sleep 5  # Give a bit more time for the app to start
response_check=0
for i in {1..3}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "✅ Application is responding on port 3000!"
        response_check=1
        break
    else
        echo "⏳ Attempt $i/3: Application not responding yet..."
        sleep 5
    fi
done

if [ $response_check -eq 0 ]; then
    echo "⚠️  Application is not responding after 3 attempts"
    startup_errors=true
fi

echo ""
echo "🎯 Setup Summary"
echo "================"

if [ "$startup_errors" = true ]; then
    echo "⚠️  Some issues were detected during startup"
    echo ""
    echo "🔧 Troubleshooting steps:"
    echo "  1. Check logs: docker compose logs -f"
    echo "  2. Check app logs: docker compose logs app"
    echo "  3. Reset database: docker compose down && docker volume rm simple-todo_postgres_data && docker compose up -d"
    echo "  4. Manual migration: docker compose exec app npx prisma migrate deploy"
    echo "  5. Manual seed: docker compose exec app npm run seed"
    echo "  6. Health check: make health"
    echo ""
else
    echo "🎉 All systems are operational!"
    echo ""
fi

# Show final access information
echo "📋 Access Information:"
echo "🌐 Application URL: http://localhost:3000"
echo "👤 Demo Account: test@example.com / test123"
echo ""
echo "📝 Useful Commands:"
echo "  make logs        # View all logs"
echo "  make down        # Stop services"
echo "  make restart     # Restart services"
echo "  make health      # Run health check"
echo "  make reset-db    # Reset database"
echo "  make fix-nextauth # Fix authentication issues"
echo ""

if [ "$startup_errors" = false ]; then
    echo "🎉 Setup Complete! Your Todo App is ready to use!"
else
    echo "⚠️  Setup completed with warnings. Please check the troubleshooting steps above."
fi

echo ""
echo "🧹 Important Notes:"
echo "  - Clear browser cache/cookies if you encounter login issues"
echo "  - The application uses secure, randomly generated keys"
echo "  - All data is stored in Docker volumes for persistence"
echo ""