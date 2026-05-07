#!/bin/bash
# Database restore script for Research Collab Hub
# Restores PostgreSQL database from a backup file

set -e

if [ -z "$1" ]; then
    echo "❌ Usage: ./restore.sh <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh backups/*.sql.gz 2>/dev/null | awk '{print "  " $9}' || echo "  (No backups found)"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  WARNING: This will OVERWRITE the current database!"
read -p "Are you sure? Type 'yes' to continue: " confirm
if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo "🔄 Starting database restore..."

# Check if postgres container is running
if ! docker ps | grep -q rch_postgres; then
    echo "❌ PostgreSQL container (rch_postgres) is not running"
    echo "Start it with: docker-compose up -d"
    exit 1
fi

# Extract backup if compressed
TEMP_FILE=$(mktemp)
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
else
    cp "$BACKUP_FILE" "$TEMP_FILE"
fi

# Drop and recreate database
echo "🗑️  Dropping existing database..."
docker exec rch_postgres psql -U postgres -c "DROP DATABASE IF EXISTS research_collab;" || true

echo "📦 Restoring from backup..."
docker exec -i rch_postgres psql -U postgres < "$TEMP_FILE"

rm "$TEMP_FILE"

echo "✅ Database restore completed successfully!"
echo ""
echo "Your data has been restored. The application will continue using the restored database."
