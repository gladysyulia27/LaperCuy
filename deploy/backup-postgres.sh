#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/opt/lapercuy/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
PROJECT_NAME="${PROJECT_NAME:-lapercuy}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/lapercuy/deploy/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-/opt/lapercuy/.env}"

mkdir -p "$BACKUP_DIR"
stamp="$(date +%Y%m%d-%H%M%S)"
file="$BACKUP_DIR/lapercuy-$stamp.dump"

docker compose --env-file "$ENV_FILE" -p "$PROJECT_NAME" -f "$COMPOSE_FILE" \
  exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$file"
test -s "$file"
find "$BACKUP_DIR" -name 'lapercuy-*.dump' -mtime +"$RETENTION_DAYS" -delete
echo "Backup created: $file"
