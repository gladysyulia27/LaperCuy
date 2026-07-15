# LaperCuy - DelQueue Smart Canteen System

LaperCuy is now a smart canteen queue system for a physical ESP32 queue terminal, student web ordering, kitchen dashboard, PostgreSQL, and Docker deployment behind Cloudflare Tunnel.

Students do not register or log in with email/password. They press the physical DelQueue button, receive a temporary code such as `ABC-123`, claim it in the web app, order food, and pay at the canteen when picking up the order.

## Main Components

- Student web app: `/index.html`, `/menu.html`, `/checkout.html`, `/orders.html`
- Kitchen dashboard: `/dapur/login.html`
- Backend API: Node.js, Express, PostgreSQL, Socket.IO
- Device API: authenticated REST endpoints for ESP32
- Firmware: `firmware/esp32-delqueue`
- Deployment: Docker Compose in `deploy/docker-compose.yml`

## Local Development

```sh
cd backend
cp .env.example .env
npm install
npm run migrate
npm run seed
npm run dev
```

Open `http://localhost:3000`.

## Core Scripts

- `npm run migrate` applies versioned SQL migrations.
- `npm run seed` inserts menu data and the first staff account from `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
- `npm run start` starts the production server after migrations.
- `npm test` runs backend tests when configured for the local database.
- `scripts/smoke-test.sh` exercises health, device code, claim, cart, order, staff status, and device ready state.

## Deployment

Production uses Docker Compose and binds the app only to `127.0.0.1:8092`. Public HTTPS should be provided by Cloudflare Tunnel for `lapercuy.yogitrim.my.id`.

See [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md).

## Security Notes

Never commit `.env`, `firmware/esp32-delqueue/include/secrets.h`, Cloudflare credentials, database dumps, SSH keys, or production backups.
