# Restore PostgreSQL Backup

1. Stop application writes:
   `docker compose --env-file /opt/lapercuy/.env -p lapercuy -f /opt/lapercuy/deploy/docker-compose.yml stop app`
2. Restore a custom-format dump:
   `docker compose --env-file /opt/lapercuy/.env -p lapercuy -f /opt/lapercuy/deploy/docker-compose.yml exec -T postgres pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB" < /opt/lapercuy/backups/lapercuy-YYYYMMDD-HHMMSS.dump`
3. Start the app:
   `docker compose --env-file /opt/lapercuy/.env -p lapercuy -f /opt/lapercuy/deploy/docker-compose.yml up -d app`
