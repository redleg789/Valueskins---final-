#!/bin/bash
# Database seeding script
# Usage: ./seed.sh [environment]
# Environments: local (default), staging, production

set -e

ENVIRONMENT="${1:-local}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-valueskins}"
DB_USER="${DB_USER:-postgres}"

echo "🌱 Seeding database: $DB_NAME@$DB_HOST:$DB_PORT (environment: $ENVIRONMENT)"

# Execute seed SQL
if [ -f "$(dirname "$0")/seed.sql" ]; then
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$(dirname "$0")/seed.sql"
    echo "✅ Database seeded successfully"
else
    echo "❌ seed.sql not found"
    exit 1
fi

# Print summary
echo ""
echo "📊 Seed Summary:"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
SELECT
    (SELECT COUNT(*) FROM users) as users,
    (SELECT COUNT(*) FROM personas) as creators,
    (SELECT COUNT(*) FROM opportunities) as opportunities,
    (SELECT COUNT(*) FROM deals) as deals;
"

echo ""
echo "💡 Next steps:"
echo "  1. Start the API server: cargo run --release"
echo "  2. Frontend API URL: http://localhost:8080"
echo "  3. Sample creator: creator_1@example.com"
echo "  4. Sample brand: brand_1@example.com"
