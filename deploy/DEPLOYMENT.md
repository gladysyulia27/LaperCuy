# LaperCuy DelQueue Deployment

The Compose app binds only to `127.0.0.1:8092`. Public access must go through Cloudflare Tunnel.

## Server Preflight

Run without changing unrelated services:

```sh
hostname
whoami
df -h
free -h
docker --version
docker compose version
docker ps
ss -tulpn
ls -la /opt
cloudflared --version || true
cloudflared tunnel list || true
systemctl list-units | grep cloudflared || true
```

If port `8092` is occupied, change only the host-side port in `deploy/docker-compose.yml` and the Cloudflare ingress service.

## Install

```sh
sudo mkdir -p /opt/lapercuy
sudo chown "$USER":"$USER" /opt/lapercuy
git clone <writable-repository-url> /opt/lapercuy
cd /opt/lapercuy
git checkout feature/delqueue-iot-integration
cp .env.example .env
chmod 600 .env
```

Generate strong values for database password, JWT secrets, cookie secret, device API key, and admin password. Do not print or commit them.

```sh
docker compose --env-file .env -p lapercuy -f deploy/docker-compose.yml up -d --build
curl -fsS http://127.0.0.1:8092/api/health
```

## Cloudflare

Use an existing managed tunnel only if it is intentionally shared. Preserve existing ingress entries and the final `http_status:404` catch-all. Otherwise create a dedicated `lapercuy-tunnel`, route `lapercuy.yogitrim.my.id`, validate config, then restart only that tunnel service.

## Update

```sh
cd /opt/lapercuy
git fetch
git checkout feature/delqueue-iot-integration
git pull --ff-only
docker compose --env-file .env -p lapercuy -f deploy/docker-compose.yml up -d --build
curl -fsS http://127.0.0.1:8092/api/health
```

## Rollback

```sh
cd /opt/lapercuy
git log --oneline -5
git checkout <previous-commit>
docker compose --env-file .env -p lapercuy -f deploy/docker-compose.yml up -d --build
```
