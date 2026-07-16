# Student Flow

1. Press the physical DelQueue button.
2. ESP32 requests a backend-generated `ABC-123` code.
3. Enter the code on the LaperCuy home page within five minutes.
4. The app stores an opaque session token in `sessionStorage`.
5. Browse menu, search, filter categories, and add notes.
6. Confirm order. Only then does the code enter the active food queue.
7. Watch the order status page update through Socket.IO with polling fallback.
8. When the order is `READY`, show a browser notification if permission was granted.
9. Pay at the canteen while picking up the order.
