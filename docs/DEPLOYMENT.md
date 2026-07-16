# Deployment

Use Docker Compose from `deploy/docker-compose.yml` with `docker compose --env-file .env`. The app is bound to `127.0.0.1:8092` and PostgreSQL has no host port.

Public access should be routed through Cloudflare Tunnel:

- hostname: `lapercuy.yogitrim.my.id`
- origin: `http://127.0.0.1:8092`

Before deployment, inspect ports, existing Docker containers, existing Cloudflare config, and `/opt` projects. Do not overwrite unrelated services.

Secrets live in `/opt/lapercuy/.env` on the server with mode `600`.
