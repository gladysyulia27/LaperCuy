# Kitchen Flow

1. Staff login at `/dapur/login.html`.
2. New confirmed orders appear in `Pesanan Baru`.
3. Staff moves orders through `TERIMA`, `MULAI PROSES`, `SIAP DIAMBIL`, and `SUDAH DIAMBIL`.
4. Rejection requires a reason.
5. Invalid transitions are rejected by the server.
6. Staff can open/close orders, set capacity, set kitchen parallelism, publish an announcement, and update stock/prep minutes.
7. `READY` orders are exposed to ESP32 display state until marked `PICKED_UP`.
