#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/opt/lapercuy/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/lapercuy/deploy}"

mkdir -p "$BACKUP_DIR"
stamp="$(date +%Y%m%d-%H%M%S)"
file="$BACKUP_DIR/lapercuy-$stamp.dump"

cd "$COMPOSE_DIR"
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$file"
test -s "$file"
find "$BACKUP_DIR" -name 'lapercuy-*.dump' -mtime +"$RETENTION_DAYS" -delete
echo "Backup created: $file"
