# API

## Student Session

- `POST /api/sessions/claim` with `{ "code": "ABC-123" }`
- `GET /api/session/me` with `Authorization: Bearer <student-token>`
- `POST /api/session/logout`

## Menu and Cart

- `GET /api/foods`
- `GET /api/foods/:foodId`
- `GET /api/cart`
- `POST /api/cart/items`
- `PATCH /api/cart/items/:id`
- `DELETE /api/cart/items/:id`

## Orders

- `POST /api/orders`
- `GET /api/orders/active`
- `GET /api/orders/:id`
- `GET /api/orders/:id/status`

Legal staff transitions:

- `QUEUED -> ACCEPTED | REJECTED | CANCELLED`
- `ACCEPTED -> PREPARING | REJECTED`
- `PREPARING -> READY`
- `READY -> PICKED_UP`

## Staff

- `POST /api/staff/login`
- `POST /api/staff/logout`
- `GET /api/staff/me`
- `GET /api/staff/orders`
- `PATCH /api/staff/orders/:id/status`
- `POST /api/staff/foods`
- `PATCH /api/staff/foods/:id`
- `DELETE /api/staff/foods/:id`
- `GET /api/staff/settings`
- `PATCH /api/staff/settings`

## Device

All device routes require `X-Device-Key`.

- `POST /api/device/sessions`
- `GET /api/device/display-state`
- `POST /api/device/heartbeat`

## Health

- `GET /api/health`
