# Database

Migrations live in `database/migrations` and are applied through `backend/scripts/migrate.js`.

Main tables:

- `staff_users`: kitchen/admin credentials with bcrypt hashes.
- `queue_sessions`: temporary device-issued codes, claim state, and order lifecycle.
- `carts` and `cart_items`: cart ownership by `session_id`.
- `orders`: queue workflow, estimates, timestamps, payment method, stock restore flag.
- `order_items`: immutable snapshots of name, price, quantity, note, and prep minutes.
- `foods`: menu, stock, availability, and prep minute data.
- `system_settings`: queue open flag, capacity, parallelism, expiry, polling, announcement.
- `device_heartbeats`: latest ESP32 diagnostic state.

The legacy destructive schema file is retained for reference only. Production should use versioned migrations and backup before destructive changes.
