# Makefile for Todo App

.PHONY: help build up down restart logs clean fix-warnings version-bump install

# Default target
help:
	@echo "Available commands:"
	@echo "  make install         - Install npm dependencies"
	@echo "  make up              - Start all services"
	@echo "  make down            - Stop all services"
	@echo "  make restart         - Restart all services"
	@echo "  make logs            - Show logs"
	@echo "  make clean           - Clean up volumes and containers"
	@echo "  make fix-warnings    - Fix PostgreSQL and Redis warnings
  make fix-nextauth    - Fix NextAuth JWT session errors
  make reset-db        - Reset database with new credentials
  make health          - Run health check on all services"
	@echo "  make version-bump    - Increment version number"

# Get current version (with fallback)
VERSION := $(shell cat .version 2>/dev/null || echo "1.0.0")

# Install dependencies
install:
	@echo "Installing npm dependencies..."
	npm install
	@echo "Dependencies installed!"

# Start services
up:
	@echo "Starting services (version: $(VERSION))..."
	@./scripts/pre-start.sh
	docker compose up -d
	@echo "Services started!"
	@echo "Access the app at: http://localhost:3100"

# Stop services
down:
	@echo "Stopping services..."
	docker compose down

# Restart services
restart: down up

# Show logs
logs:
	docker compose logs -f

# Clean everything
clean:
	@echo "Cleaning up..."
	docker compose down -v
	docker system prune -af

# Fix warnings
fix-warnings:
	@echo "Fixing PostgreSQL collation warnings..."
	@./scripts/fix-collation-immediately.sh
	@echo "Fixing Redis memory overcommit..."
	@echo "Please run: sudo sysctl vm.overcommit_memory=1"

# Version management
version-bump:
	@echo "Current version: $(VERSION)"
	@read -p "Enter new version: " new_version; \
	echo $$new_version > .version; \
	sed -i "s/APP_VERSION=.*/APP_VERSION=$$new_version/" .env.example; \
	echo "Version updated to: $$new_version"


# Fix NextAuth JWT errors
fix-nextauth:
	@echo "Fixing NextAuth JWT session errors..."
	@./scripts/fix-nextauth-error.sh

# Reset database
reset-db:
	@echo "Resetting database with new credentials..."
	@./scripts/reset-database.sh

# Health check
health:
	@echo "Running health check..."
	@./scripts/health-check.sh