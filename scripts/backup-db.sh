#!/usr/bin/env bash
# =============================================================================
#  Dine&Stay OS — PostgreSQL Backup Script
#  Usage:
#    ./scripts/backup-db.sh              # dump + upload (uses .env at repo root)
#    ./scripts/backup-db.sh --local-only # dump to disk, skip S3
#    ./scripts/backup-db.sh --restore <file>  # restore from a .sql.gz file
#
#  Cron example (2 AM IST daily):
#    0 20 * * * /bin/bash /opt/dinestay/scripts/backup-db.sh >> /var/log/dinestay-backup.log 2>&1
#
#  Environment variables (read from .env if present, else from shell env):
#    DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
#    BACKUP_S3_BUCKET, BACKUP_S3_PREFIX, BACKUP_S3_REGION
#    BACKUP_S3_ACCESS_KEY, BACKUP_S3_SECRET_KEY, BACKUP_S3_ENDPOINT
#    BACKUP_DIR           (default: ./backups)
#    BACKUP_RETENTION_DAYS (default: 30)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# ─── Load .env from repo root if it exists ───────────────────────────────────
if [[ -f "$REPO_ROOT/.env" ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$REPO_ROOT/.env" | grep -v '^$' | xargs)
fi

# ─── Config with defaults ────────────────────────────────────────────────────
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-dinestayadmin}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-dinestay}"

BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:-}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-db-backups}"
BACKUP_S3_REGION="${BACKUP_S3_REGION:-ap-south-1}"
BACKUP_S3_ACCESS_KEY="${BACKUP_S3_ACCESS_KEY:-${S3_ACCESS_KEY:-}}"
BACKUP_S3_SECRET_KEY="${BACKUP_S3_SECRET_KEY:-${S3_SECRET_KEY:-}}"
BACKUP_S3_ENDPOINT="${BACKUP_S3_ENDPOINT:-${S3_ENDPOINT:-}}"

LOCAL_ONLY=false
RESTORE_FILE=""

# ─── Argument parsing ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --local-only) LOCAL_ONLY=true; shift ;;
    --restore)    RESTORE_FILE="${2:-}"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# ─── Restore mode ─────────────────────────────────────────────────────────────
if [[ -n "$RESTORE_FILE" ]]; then
  echo "🔄 [$(date '+%Y-%m-%d %H:%M:%S')] Restoring from: $RESTORE_FILE"

  if [[ ! -f "$RESTORE_FILE" ]]; then
    echo "❌ File not found: $RESTORE_FILE"
    exit 1
  fi

  export PGPASSWORD="$DB_PASSWORD"

  echo "⚠️  This will DROP and RECREATE the database '$DB_NAME'. Press Ctrl+C to abort."
  sleep 5

  # Drop all connections and restore
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" || true
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" || true
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"

  pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-acl --verbose "$RESTORE_FILE"

  echo "✅ Restore complete."
  exit 0
fi

# ─── Backup mode ──────────────────────────────────────────────────────────────
TIMESTAMP="$(date '+%Y-%m-%dT%H-%M-%S')"
FILENAME="${DB_NAME}_${TIMESTAMP}.dump.gz"
mkdir -p "$BACKUP_DIR"
OUTFILE="$BACKUP_DIR/$FILENAME"

echo "🗄️  [$(date '+%Y-%m-%d %H:%M:%S')] Starting backup of '$DB_NAME' → $FILENAME"

# ── Check pg_dump is available ───────────────────────────────────────────────
if ! command -v pg_dump &>/dev/null; then
  echo "❌ pg_dump not found. Install postgresql-client."
  exit 1
fi

START_TS=$(date +%s)
export PGPASSWORD="$DB_PASSWORD"

# pg_dump with custom format piped through gzip
pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -Fc \
  --no-password \
  "$DB_NAME" \
  | gzip -9 > "$OUTFILE"

END_TS=$(date +%s)
DURATION=$((END_TS - START_TS))
SIZE_BYTES=$(stat -f%z "$OUTFILE" 2>/dev/null || stat -c%s "$OUTFILE" 2>/dev/null || echo 0)
SIZE_MB=$(echo "scale=2; $SIZE_BYTES / 1048576" | bc 2>/dev/null || echo "?")

echo "✅ Dump complete: $OUTFILE (${SIZE_MB} MB) in ${DURATION}s"

# ─── Upload to S3 ─────────────────────────────────────────────────────────────
if [[ "$LOCAL_ONLY" == "false" && -n "$BACKUP_S3_BUCKET" ]]; then
  if ! command -v aws &>/dev/null; then
    echo "⚠️  aws CLI not found — skipping S3 upload. Install with: pip install awscli"
  else
    S3_KEY="$BACKUP_S3_PREFIX/$FILENAME"
    S3_URI="s3://$BACKUP_S3_BUCKET/$S3_KEY"

    AWS_ARGS=(
      --region "$BACKUP_S3_REGION"
      --output json
    )

    # Custom endpoint for MinIO / R2 / DO Spaces
    if [[ -n "$BACKUP_S3_ENDPOINT" ]]; then
      AWS_ARGS+=(--endpoint-url "$BACKUP_S3_ENDPOINT")
    fi

    AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" \
    AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
    aws s3 cp "$OUTFILE" "$S3_URI" "${AWS_ARGS[@]}"

    echo "☁️  Uploaded to: $S3_URI"
  fi
else
  echo "📁 Local-only mode — skipping S3 upload"
fi

# ─── Prune old local backups ──────────────────────────────────────────────────
echo "🧹 Pruning local backups older than ${BACKUP_RETENTION_DAYS} days…"
find "$BACKUP_DIR" -name "*.dump.gz" -o -name "*.sql.gz" | while read -r f; do
  if [[ "$(uname)" == "Darwin" ]]; then
    FILE_AGE_DAYS=$(( ( $(date +%s) - $(stat -f%m "$f") ) / 86400 ))
  else
    FILE_AGE_DAYS=$(( ( $(date +%s) - $(stat -c%Y "$f") ) / 86400 ))
  fi
  if [[ "$FILE_AGE_DAYS" -gt "$BACKUP_RETENTION_DAYS" ]]; then
    rm -f "$f"
    echo "  🗑  Deleted: $(basename "$f") (${FILE_AGE_DAYS}d old)"
  fi
done

echo "✅ [$(date '+%Y-%m-%d %H:%M:%S')] Backup job finished."
