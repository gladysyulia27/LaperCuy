# Architecture

DelQueue has six moving parts:

1. ESP32 terminal requests temporary queue codes from the backend.
2. Student web app claims a code, builds a cart, confirms one order, and receives realtime status.
3. Kitchen dashboard authenticates staff and manages legal order transitions.
4. Express backend owns sessions, carts, orders, stock, estimates, staff auth, and device API.
5. PostgreSQL stores queue sessions, carts, orders, immutable order items, staff users, settings, and device heartbeat state.
6. Cloudflare Tunnel exposes the localhost-only Docker service publicly without opening a router port.

Socket.IO rooms:

- `kitchen`
- `student:<session-id>`

ESP32 uses REST polling rather than websockets for reliability.
