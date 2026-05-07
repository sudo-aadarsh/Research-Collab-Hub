#!/bin/bash
# Database backup script for Research Collab Hub
# Backs up PostgreSQL database to a timestamped SQL file

set -e

BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/research_collab_${TIMESTAMP}.sql"

echo "🔄 Starting database backup..."

# Check if postgres container is running
if ! docker ps | grep -q rch_postgres; then
    echo "❌ PostgreSQL container (rch_postgres) is not running"
    echo "Start it with: docker-compose up -d"
    exit 1
fi

# Perform backup using pg_dump
docker exec rch_postgres pg_dump \
    -U postgres \
    -d research_collab \
    --no-password \
    --verbose \
    > "$BACKUP_FILE"

# Compress the backup
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

# Get file size
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo "✅ Backup completed successfully!"
echo "📁 Location: $BACKUP_FILE"
echo "📊 Size: $SIZE"
echo ""
echo "Keep this file safe. To restore:"
echo "  ./backups/restore.sh $BACKUP_FILE"
