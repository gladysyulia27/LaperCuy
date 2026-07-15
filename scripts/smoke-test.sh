#!/usr/bin/env sh
set -eu

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
DEVICE_API_KEY="${DEVICE_API_KEY:?set DEVICE_API_KEY}"
ADMIN_USERNAME="${ADMIN_USERNAME:?set ADMIN_USERNAME}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?set ADMIN_PASSWORD}"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

echo "1 health"
curl -fsS "$BASE_URL/api/health" >/dev/null

echo "2 device code"
curl -fsS -X POST "$BASE_URL/api/device/sessions" \
  -H "Content-Type: application/json" \
  -H "X-Device-Key: $DEVICE_API_KEY" \
  -H "X-Device-ID: smoke" \
  -H "X-Request-ID: smoke-$(date +%s)" \
  -d '{"firmwareVersion":"smoke"}' > "$tmp"
code="$(node -e "console.log(require('fs').readFileSync('$tmp','utf8').match(/\"code\":\"([^\"]+)/)[1])")"

echo "3 claim code"
curl -fsS -X POST "$BASE_URL/api/sessions/claim" -H "Content-Type: application/json" -d "{\"code\":\"$code\"}" > "$tmp"
student="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$tmp','utf8')).token)")"

echo "4 fetch menu"
curl -fsS "$BASE_URL/api/foods" > "$tmp"
food="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$tmp','utf8')).foods.find(f=>f.is_available).food_id)")"

echo "5 create cart"
curl -fsS -X POST "$BASE_URL/api/cart/items" -H "Authorization: Bearer $student" -H "Content-Type: application/json" -d "{\"food_id\":\"$food\",\"quantity\":1}" >/dev/null

echo "6 confirm order"
curl -fsS -X POST "$BASE_URL/api/orders" -H "Authorization: Bearer $student" -H "Content-Type: application/json" -d '{}' > "$tmp"
order_id="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$tmp','utf8')).order.id)")"

echo "7 staff login"
curl -fsS -X POST "$BASE_URL/api/staff/login" -H "Content-Type: application/json" -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}" > "$tmp"
staff="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$tmp','utf8')).token)")"

echo "8 update status"
for status in ACCEPTED PREPARING READY; do
  curl -fsS -X PATCH "$BASE_URL/api/staff/orders/$order_id/status" -H "Authorization: Bearer $staff" -H "Content-Type: application/json" -d "{\"status\":\"$status\"}" >/dev/null
done

echo "9 student status"
curl -fsS "$BASE_URL/api/orders/$order_id/status" -H "Authorization: Bearer $student" >/dev/null

echo "10 device ready state"
curl -fsS "$BASE_URL/api/device/display-state" -H "X-Device-Key: $DEVICE_API_KEY" >/dev/null

echo "smoke test passed"
