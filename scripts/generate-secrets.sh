#!/bin/bash
# Generate secure secrets for NextAuth.js

set -e

echo "🔐 Generating secure secrets..."

# Generate a strong NEXTAUTH_SECRET (32 bytes base64 encoded)
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Generate secure database password
DB_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)

echo "Generated secrets:"
echo "NEXTAUTH_SECRET: $NEXTAUTH_SECRET"
echo "DB_PASSWORD: $DB_PASSWORD"
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "📝 Updating .env file..."
    
    # Backup current .env
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backed up current .env file"
    
    # Update NEXTAUTH_SECRET
    sed -i.tmp "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$NEXTAUTH_SECRET|" .env
    
    # Update database password in multiple places
    sed -i.tmp "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$DB_PASSWORD|" .env
    sed -i.tmp "s|your-secure-password-change-me|$DB_PASSWORD|g" .env
    
    # Clean up temp file
    rm -f .env.tmp
    
    echo "✅ Updated .env file with new secrets"
else
    echo "📋 Creating .env file from template..."
    cp .env.example .env
    
    # Update with generated secrets
    sed -i.tmp "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$NEXTAUTH_SECRET|" .env
    sed -i.tmp "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$DB_PASSWORD|" .env
    sed -i.tmp "s|your-secure-password-change-me|$DB_PASSWORD|g" .env
    
    # Clean up temp file
    rm -f .env.tmp
    
    echo "✅ Created .env file with secure secrets"
fi

echo ""
echo "🔒 Security improvements applied:"
echo "  - Generated cryptographically secure NEXTAUTH_SECRET"
echo "  - Generated random database password"
echo "  - Backed up previous configuration"
echo ""
echo "⚠️  IMPORTANT: If containers are already running, restart them:"
echo "   docker compose down && docker compose up -d"