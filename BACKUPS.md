# Database Backups & Data Persistence

Your Research Collab Hub data is now protected with automated backup capabilities.

## Quick Start

### Manual Backup
Create a backup of your current database anytime:

```bash
cd /home/aadarsh/Documents/ResearchCollabHub
./backups/backup.sh
```

This creates a compressed SQL file in the `backups/` directory with timestamp.

**Example output:**
```
✅ Backup completed successfully!
📁 Location: backups/research_collab_20260507_152430.sql.gz
📊 Size: 2.3M

Keep this file safe. To restore:
  ./backups/restore.sh backups/research_collab_20260507_152430.sql.gz
```

### Restore from Backup
If you need to restore your database from a backup:

```bash
./backups/restore.sh backups/research_collab_20260507_152430.sql.gz
```

**Important:** This will overwrite your current database. You'll be asked to confirm before proceeding.

## Automatic Daily Backups (Optional)

### Option 1: Linux/Mac Cron Job

Add a cron job to automatically backup daily at 2 AM:

```bash
# Open crontab editor
crontab -e

# Add this line (backs up daily at 2 AM)
0 2 * * * cd /home/aadarsh/Documents/ResearchCollabHub && ./backups/backup.sh >> /tmp/rch_backup.log 2>&1
```

### Option 2: Docker-Based Backup Service

Modify `docker-compose.yml` to include an automatic backup service:

```yaml
# Add this to docker-compose.yml services section:
backup:
  image: postgres:16-alpine
  container_name: rch_backup
  restart: always
  environment:
    PGPASSWORD: postgres
  command: |
    sh -c '
    while true; do
      TIMESTAMP=$$(date +\%Y\%m\%d_\%H\%M\%S)
      pg_dump -h postgres -U postgres -d research_collab | gzip > /backups/research_collab_$${TIMESTAMP}.sql.gz
      find /backups -name "research_collab_*.sql.gz" -mtime +7 -delete
      sleep 86400
    done
    '
  depends_on:
    - postgres
  volumes:
    - ./backups:/backups
    - pgdata:/var/lib/postgresql/data:ro
```

Then restart:
```bash
docker-compose down
docker-compose up -d
```

This automatically:
- ✅ Backs up database daily
- ✅ Keeps only the last 7 days of backups
- ✅ Runs silently in the background

## File Management

### View Available Backups
```bash
ls -lh backups/
```

### Delete Old Backups
```bash
# Keep only the last 5 backups
ls -t backups/research_collab_*.sql.gz | tail -n +6 | xargs rm -f

# Or delete backups older than 30 days
find backups/ -name "research_collab_*.sql.gz" -mtime +30 -delete
```

### Backup Off-Site
For extra safety, copy backups to cloud storage or another machine:

```bash
# Copy to another location
cp backups/research_collab_*.sql.gz /path/to/external/backup/

# Or upload to cloud (example with rsync)
rsync -avz backups/ user@remote-server:/path/to/backups/
```

## Data Persistence

Your database volume is now configured to persist between container restarts:

- **PostgreSQL data** is stored in the `pgdata` Docker volume
- Data remains even if containers are stopped (`docker-compose stop`)
- Data is **only deleted** if you explicitly remove volumes (`docker-compose down -v`)

**Safe operations (data preserved):**
```bash
docker-compose stop          # Stop containers but keep data
docker-compose start         # Resume with all data intact
docker-compose down          # Stop containers, keep data
docker-compose up -d         # Restart, data is restored
```

**Dangerous operation (data lost):**
```bash
docker-compose down -v       # ⚠️  DELETES DATABASE VOLUME
```

## Recovery Scenarios

### Scenario 1: I want to test something but keep my current data
```bash
# Backup current state
./backups/backup.sh

# Make your test changes...

# Restore if needed
./backups/restore.sh backups/research_collab_TIMESTAMP.sql.gz
```

### Scenario 2: Application crashed, restore last backup
```bash
# Find your most recent backup
ls -t backups/ | head -1

# Restore it
./backups/restore.sh backups/research_collab_TIMESTAMP.sql.gz

# Restart application
docker-compose down
docker-compose up -d
```

### Scenario 3: Move data to another machine
```bash
# On machine A: Create backup
./backups/backup.sh

# Copy file to machine B
scp backups/research_collab_*.sql.gz user@machine-b:/path/to/research-collab/backups/

# On machine B: Restore
cd /path/to/research-collab
./backups/restore.sh backups/research_collab_*.sql.gz
```

## Best Practices

✅ **DO:**
- Back up before making major changes
- Keep backups in at least 2 locations
- Test restore procedures occasionally
- Name backups descriptively (e.g., `research_collab_before_migration.sql.gz`)
- Delete old backups to save space

❌ **DON'T:**
- Use `docker-compose down -v` during development
- Delete backup files without copies elsewhere
- Store only one backup
- Ignore backup errors

## Troubleshooting

**"PostgreSQL container is not running"**
```bash
# Start the application
docker-compose up -d
```

**"pg_dump: command not found"**
- The PostgreSQL client tools should be installed automatically in the container
- Make sure `rch_postgres` container is running: `docker ps | grep rch_postgres`

**"Permission denied" on backup scripts**
```bash
chmod +x ./backups/*.sh
```

**Backup file is corrupted**
- Try restoring from an earlier backup
- Check that PostgreSQL was running when backup was created
- Verify file integrity: `gunzip -t backups/*.sql.gz`

---

**Questions?** All backup files are stored in `backups/` directory and are standard PostgreSQL dumps (compatible with any PostgreSQL 16 installation).
