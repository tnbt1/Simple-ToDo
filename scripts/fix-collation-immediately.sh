#!/bin/bash
# Fix collation warnings for existing database

echo "Fixing PostgreSQL collation warnings..."

# Fix collation for all databases
docker compose exec -T postgres psql -U ${POSTGRES_USER:-todouser} -d postgres <<EOF
UPDATE pg_database SET datcollversion = NULL WHERE datname IN ('todoapp', 'postgres', 'template1', 'template0');
EOF

echo "Collation warnings fixed!"

# Verify the fix
echo "Verifying fix..."
docker compose exec -T postgres psql -U ${POSTGRES_USER:-todouser} -d postgres -c "SELECT datname, datcollversion FROM pg_database;"