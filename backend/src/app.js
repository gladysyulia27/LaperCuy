require('dotenv').config();

const crypto = require('crypto');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const env = require('../config/env');
const realtime = require('./realtime');

const app = express();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = /^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/;
const ACTIVE_STATUSES = ['QUEUED', 'ACCEPTED', 'PREPARING'];
const TERMINAL_STATUSES = ['PICKED_UP', 'REJECTED', 'CANCELLED'];
const LEGAL_TRANSITIONS = {
  QUEUED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'REJECTED'],
  PREPARING: ['READY'],
  READY: ['PICKED_UP'],
  PICKED_UP: [],
  REJECTED: [],
  CANCELLED: [],
};

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));
app.use(cookieParser(env.cookieSecret));

const frontendPath = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendPath));

const claimLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
const staffLoginLimiter = rateLimit({ windowMs: 60_000, limit: 8, standardHeaders: true, legacyHeaders: false });
const deviceLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function signStudent(session) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ type: 'student', sessionId: session.id, code: session.code, jti }, env.studentJwtSecret, { expiresIn: '8h' });
  return { token, jti };
}

function signStaff(staff) {
  return jwt.sign({ type: 'staff', id: staff.id, username: staff.username, role: staff.role }, env.staffJwtSecret, { expiresIn: '10h' });
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function generateCode() {
  let raw = '';
  for (let i = 0; i < 6; i += 1) raw += CODE_CHARS[crypto.randomInt(0, CODE_CHARS.length)];
  return `${raw.slice(0, 3)}-${raw.slice(3)}`;
}

function safeFood(row) {
  return {
    id: row.id,
    food_id: row.food_id,
    name: row.name,
    price: Number(row.price),
    category: row.category,
    sold_label: row.sold_label,
    img: row.img,
    badge: row.badge,
    tag: row.tag,
    description: row.description,
    stock: Number(row.stock),
    prep_minutes: Number(row.prep_minutes),
    is_available: row.is_available && Number(row.stock) > 0,
  };
}

async function getSettings(client = db) {
  const result = await client.query('SELECT * FROM system_settings WHERE id = 1');
  return result.rows[0] || {
    orders_open: true,
    maximum_active_orders: env.maxActiveOrders,
    kitchen_parallelism: env.kitchenParallelism,
    default_session_expiry_minutes: env.sessionCodeExpiryMinutes,
    claimed_session_expiry_minutes: 30,
    device_poll_seconds: 3,
    public_announcement: null,
  };
}

async function expireOldSessions(client = db) {
  await client.query(
    `UPDATE queue_sessions SET status = 'EXPIRED'
     WHERE status = 'ISSUED' AND expires_at < CURRENT_TIMESTAMP`
  );
}

async function activeQueueSummary(client = db) {
  const settings = await getSettings(client);
  const active = await client.query(
    `SELECT COALESCE(COUNT(*),0)::int AS count, COALESCE(SUM(queue_weight),0)::int AS weight
     FROM orders WHERE status = ANY($1)`,
    [ACTIVE_STATUSES]
  );
  const minutes = Math.max(3, Math.ceil(Number(active.rows[0].weight || 0) / Number(settings.kitchen_parallelism || 1)));
  return {
    ordersOpen: settings.orders_open,
    activeOrderCount: Number(active.rows[0].count),
    approximateWaitMin: Math.max(1, Math.floor(minutes * 0.8)),
    approximateWaitMax: Math.max(3, Math.ceil(minutes * 1.2)),
    announcement: settings.public_announcement,
  };
}

async function orderDetails(orderId, client = db) {
  const orderResult = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  const order = orderResult.rows[0];
  if (!order) return null;
  const items = await client.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [orderId]);
  return { ...order, items: items.rows };
}

function studentAuth(req, res, next) {
  const header = req.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Sesi antrean tidak ditemukan.' });
  try {
    req.student = jwt.verify(header.slice(7), env.studentJwtSecret);
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Sesi antrean tidak valid atau kedaluwarsa.' });
  }
}

function staffAuth(req, res, next) {
  const bearer = (req.get('authorization') || '').startsWith('Bearer ') ? req.get('authorization').slice(7) : null;
  const token = bearer || req.cookies.staff_token;
  if (!token) return res.status(401).json({ success: false, message: 'Login staff diperlukan.' });
  try {
    req.staff = jwt.verify(token, env.staffJwtSecret);
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Sesi staff tidak valid.' });
  }
}

function deviceAuth(req, res, next) {
  const supplied = req.get('x-device-key') || '';
  const expected = env.deviceApiKey;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ success: false, message: 'Device key tidak valid.' });
  }
  return next();
}

async function getSessionCart(sessionId, client = db) {
  const existing = await client.query('SELECT id FROM carts WHERE session_id = $1', [sessionId]);
  if (existing.rowCount) return existing.rows[0];
  const created = await client.query('INSERT INTO carts (session_id) VALUES ($1) RETURNING id', [sessionId]);
  return created.rows[0];
}

async function cartPayload(sessionId, client = db) {
  const cart = await getSessionCart(sessionId, client);
  const items = await client.query(
    `SELECT ci.id, ci.quantity, ci.note, f.id AS food_db_id, f.food_id, f.name, f.price, f.img,
            f.is_available, f.stock, f.prep_minutes
     FROM cart_items ci JOIN foods f ON f.id = ci.food_id
     WHERE ci.cart_id = $1 ORDER BY ci.id`,
    [cart.id]
  );
  const subtotal = items.rows.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  return {
    id: cart.id,
    items: items.rows,
    subtotal,
    itemCount: items.rows.reduce((sum, item) => sum + Number(item.quantity), 0),
  };
}

app.get('/api/health', asyncHandler(async (req, res) => {
  await db.query('SELECT 1');
  res.json({ success: true, status: 'ok', database: 'ok', version: '2.0.0-delqueue', timestamp: new Date().toISOString() });
}));

app.post('/api/device/sessions', deviceLimiter, deviceAuth, asyncHandler(async (req, res) => {
  const deviceId = req.get('x-device-id') || req.body.deviceId || 'delqueue-01';
  const requestId = req.get('x-request-id') || null;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await expireOldSessions(client);
    if (requestId) {
      const existing = await client.query('SELECT * FROM queue_sessions WHERE request_id = $1', [requestId]);
      if (existing.rowCount) {
        const summary = await activeQueueSummary(client);
        await client.query('COMMIT');
        return res.status(200).json({ success: true, code: existing.rows[0].code, expiresAt: existing.rows[0].expires_at, queueSummary: summary });
      }
    }

    const settings = await getSettings(client);
    let code = generateCode();
    for (let i = 0; i < 8; i += 1) {
      const exists = await client.query('SELECT id FROM queue_sessions WHERE code = $1 AND status IN ($2,$3)', [code, 'ISSUED', 'CLAIMED']);
      if (!exists.rowCount) break;
      code = generateCode();
    }

    const created = await client.query(
      `INSERT INTO queue_sessions (code, device_id, request_id, expires_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP + ($4 || ' minutes')::interval)
       RETURNING *`,
      [code, deviceId, requestId, settings.default_session_expiry_minutes]
    );
    const summary = await activeQueueSummary(client);
    await client.query('COMMIT');
    return res.status(201).json({ success: true, code: created.rows[0].code, expiresAt: created.rows[0].expires_at, queueSummary: summary });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.get('/api/device/display-state', deviceLimiter, deviceAuth, asyncHandler(async (req, res) => {
  const summary = await activeQueueSummary();
  const ready = await db.query(
    `SELECT id, order_code AS code, ready_at AS "readyAt"
     FROM orders WHERE status = 'READY' ORDER BY ready_at ASC`
  );
  res.json({
    online: true,
    ordersOpen: summary.ordersOpen,
    activeQueueCount: summary.activeOrderCount,
    readyOrders: ready.rows,
    message: summary.announcement,
    serverTime: new Date().toISOString(),
  });
}));

app.post('/api/device/heartbeat', deviceLimiter, deviceAuth, asyncHandler(async (req, res) => {
  const deviceId = req.get('x-device-id') || req.body.deviceId || 'delqueue-01';
  await db.query(
    `INSERT INTO device_heartbeats (device_id, firmware_version, wifi_rssi, ip_reported, last_seen_at)
     VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP)
     ON CONFLICT (device_id) DO UPDATE SET
       firmware_version = EXCLUDED.firmware_version,
       wifi_rssi = EXCLUDED.wifi_rssi,
       ip_reported = EXCLUDED.ip_reported,
       last_seen_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP`,
    [deviceId, req.body.firmwareVersion || null, req.body.wifiRssi || null, req.body.ip || null]
  );
  res.json({ success: true });
}));

app.post('/api/sessions/claim', claimLimiter, asyncHandler(async (req, res) => {
  const code = normalizeCode(req.body.code);
  if (!CODE_RE.test(code)) return res.status(422).json({ success: false, message: 'Format kode harus ABC-123.' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await expireOldSessions(client);
    const result = await client.query('SELECT * FROM queue_sessions WHERE code = $1 FOR UPDATE', [code]);
    const session = result.rows[0];
    if (!session) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Kode tidak ditemukan.' });
    }
    if (session.status !== 'ISSUED') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Kode sudah digunakan atau tidak aktif.' });
    }
    if (new Date(session.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(410).json({ success: false, message: 'Kode sudah kedaluwarsa.' });
    }

    const { token, jti } = signStudent(session);
    const updated = await client.query(
      `UPDATE queue_sessions SET status = 'CLAIMED', claimed_at = CURRENT_TIMESTAMP, student_token_jti = $2
       WHERE id = $1 RETURNING *`,
      [session.id, jti]
    );
    await getSessionCart(session.id, client);
    await client.query('COMMIT');
    return res.json({ success: true, token, session: { code, status: updated.rows[0].status, expiresAt: updated.rows[0].expires_at } });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.get('/api/session/me', studentAuth, asyncHandler(async (req, res) => {
  const session = await db.query('SELECT id, code, status, expires_at FROM queue_sessions WHERE id = $1 AND student_token_jti = $2', [req.student.sessionId, req.student.jti]);
  if (!session.rowCount) return res.status(401).json({ success: false, message: 'Sesi tidak ditemukan.' });
  const order = await db.query('SELECT id, order_code, status, estimated_wait_minutes, estimated_ready_at FROM orders WHERE session_id = $1 ORDER BY id DESC LIMIT 1', [req.student.sessionId]);
  res.json({ success: true, session: { code: session.rows[0].code, status: session.rows[0].status, expiresAt: session.rows[0].expires_at }, order: order.rows[0] || null });
}));

app.post('/api/session/logout', studentAuth, (req, res) => res.json({ success: true }));

app.get('/api/foods', asyncHandler(async (req, res) => {
  const { category, q } = req.query;
  const params = [];
  let where = 'WHERE 1=1';
  if (category && category !== 'all') {
    params.push(category);
    where += ` AND category = $${params.length}`;
  }
  if (q) {
    params.push(`%${String(q).trim()}%`);
    where += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
  }
  const result = await db.query(`SELECT * FROM foods ${where} ORDER BY is_available DESC, category, name`, params);
  res.json({ success: true, count: result.rowCount, foods: result.rows.map(safeFood) });
}));

app.get('/api/foods/:foodId', asyncHandler(async (req, res) => {
  const result = await db.query('SELECT * FROM foods WHERE food_id = $1 OR id::text = $1', [req.params.foodId]);
  if (!result.rowCount) return res.status(404).json({ success: false, message: 'Menu tidak ditemukan.' });
  res.json({ success: true, food: safeFood(result.rows[0]) });
}));

app.get('/api/cart', studentAuth, asyncHandler(async (req, res) => {
  res.json({ success: true, cart: await cartPayload(req.student.sessionId) });
}));

app.post('/api/cart/items', studentAuth, asyncHandler(async (req, res) => {
  const quantity = Math.max(1, parseInt(req.body.quantity || '1', 10));
  const note = String(req.body.note || '').slice(0, 300);
  const food = await db.query('SELECT * FROM foods WHERE food_id = $1 OR id::text = $1', [String(req.body.food_id || req.body.foodId || '')]);
  if (!food.rowCount) return res.status(404).json({ success: false, message: 'Menu tidak ditemukan.' });
  if (!food.rows[0].is_available || Number(food.rows[0].stock) < quantity) return res.status(409).json({ success: false, message: 'Stok menu tidak cukup.' });
  const cart = await getSessionCart(req.student.sessionId);
  const existing = await db.query('SELECT id FROM cart_items WHERE cart_id = $1 AND food_id = $2', [cart.id, food.rows[0].id]);
  if (existing.rowCount) {
    await db.query('UPDATE cart_items SET quantity = quantity + $1, note = COALESCE(NULLIF($2, \'\'), note) WHERE id = $3', [quantity, note, existing.rows[0].id]);
  } else {
    await db.query('INSERT INTO cart_items (cart_id, food_id, quantity, note) VALUES ($1,$2,$3,$4)', [cart.id, food.rows[0].id, quantity, note || null]);
  }
  res.status(201).json({ success: true, cart: await cartPayload(req.student.sessionId) });
}));

app.patch('/api/cart/items/:id', studentAuth, asyncHandler(async (req, res) => {
  const cart = await getSessionCart(req.student.sessionId);
  const quantity = req.body.quantity === undefined ? null : parseInt(req.body.quantity, 10);
  const note = req.body.note === undefined ? null : String(req.body.note).slice(0, 300);
  const item = await db.query('SELECT id FROM cart_items WHERE id = $1 AND cart_id = $2', [req.params.id, cart.id]);
  if (!item.rowCount) return res.status(404).json({ success: false, message: 'Item tidak ditemukan.' });
  if (quantity !== null && quantity <= 0) {
    await db.query('DELETE FROM cart_items WHERE id = $1', [req.params.id]);
  } else {
    await db.query(
      'UPDATE cart_items SET quantity = COALESCE($1, quantity), note = COALESCE($2, note) WHERE id = $3',
      [quantity, note, req.params.id]
    );
  }
  res.json({ success: true, cart: await cartPayload(req.student.sessionId) });
}));

app.delete('/api/cart/items/:id', studentAuth, asyncHandler(async (req, res) => {
  const cart = await getSessionCart(req.student.sessionId);
  await db.query('DELETE FROM cart_items WHERE id = $1 AND cart_id = $2', [req.params.id, cart.id]);
  res.json({ success: true, cart: await cartPayload(req.student.sessionId) });
}));

app.delete('/api/cart', studentAuth, asyncHandler(async (req, res) => {
  const cart = await getSessionCart(req.student.sessionId);
  await db.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);
  res.json({ success: true, cart: await cartPayload(req.student.sessionId) });
}));

app.get('/api/queue/summary', asyncHandler(async (req, res) => {
  const summary = await activeQueueSummary();
  res.json({ success: true, ...summary });
}));

app.get('/api/queue/my-estimate', studentAuth, asyncHandler(async (req, res) => {
  const order = await db.query('SELECT id, created_at FROM orders WHERE session_id = $1 ORDER BY id DESC LIMIT 1', [req.student.sessionId]);
  if (!order.rowCount) return res.json({ success: true, queueAhead: null, approximateWaitMin: 0, approximateWaitMax: 0 });
  const ahead = await db.query(
    `SELECT COALESCE(COUNT(*),0)::int AS count, COALESCE(SUM(queue_weight),0)::int AS weight
     FROM orders WHERE status = ANY($1) AND created_at < $2`,
    [ACTIVE_STATUSES, order.rows[0].created_at]
  );
  const settings = await getSettings();
  const minutes = Math.max(1, Math.ceil(Number(ahead.rows[0].weight || 0) / Number(settings.kitchen_parallelism || 1)));
  res.json({ success: true, queueAhead: Number(ahead.rows[0].count), approximateWaitMin: Math.floor(minutes * 0.8), approximateWaitMax: Math.ceil(minutes * 1.2) });
}));

app.post('/api/orders', studentAuth, asyncHandler(async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const session = await client.query('SELECT * FROM queue_sessions WHERE id = $1 AND student_token_jti = $2 FOR UPDATE', [req.student.sessionId, req.student.jti]);
    if (!session.rowCount || session.rows[0].status !== 'CLAIMED') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Sesi tidak valid untuk membuat pesanan.' });
    }
    const settings = await getSettings(client);
    if (!settings.orders_open) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Pesanan sedang ditutup.' });
    }
    const active = await client.query('SELECT COUNT(*)::int AS count FROM orders WHERE status = ANY($1)', [ACTIVE_STATUSES]);
    if (Number(active.rows[0].count) >= Number(settings.maximum_active_orders)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Antrean sedang penuh.' });
    }
    const duplicate = await client.query('SELECT id FROM orders WHERE session_id = $1', [req.student.sessionId]);
    if (duplicate.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Satu kode hanya dapat membuat satu pesanan.' });
    }

    const cart = await getSessionCart(req.student.sessionId, client);
    const items = await client.query(
      `SELECT ci.quantity, ci.note, f.id AS food_id, f.name, f.price, f.stock, f.is_available, f.prep_minutes
       FROM cart_items ci JOIN foods f ON f.id = ci.food_id
      WHERE ci.cart_id = $1 FOR UPDATE OF f`,
      [cart.id]
    );
    if (!items.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Keranjang masih kosong.' });
    }
    for (const item of items.rows) {
      if (!item.is_available || Number(item.stock) < Number(item.quantity)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: `Stok ${item.name} tidak cukup.` });
      }
    }

    const subtotal = items.rows.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
    const weight = items.rows.reduce((sum, item) => sum + Number(item.prep_minutes) * Number(item.quantity), 0);
    const ahead = await client.query('SELECT COALESCE(SUM(queue_weight),0)::int AS weight FROM orders WHERE status = ANY($1)', [ACTIVE_STATUSES]);
    const estimated = Math.max(1, Math.ceil(Number(ahead.rows[0].weight || 0) / Number(settings.kitchen_parallelism || 1)));
    const orderCode = session.rows[0].code;
    const order = await client.query(
      `INSERT INTO orders (order_code, session_id, subtotal, discount, grand_total, payment_method, status,
                           queue_weight, estimated_wait_minutes, estimated_ready_at)
       VALUES ($1,$2,$3,0,$3,'pay_at_pickup','QUEUED',$4,$5,CURRENT_TIMESTAMP + ($5 || ' minutes')::interval)
       RETURNING *`,
      [orderCode, req.student.sessionId, subtotal, weight, estimated]
    );
    for (const item of items.rows) {
      await client.query('UPDATE foods SET stock = stock - $1, sold_count = sold_count + $1 WHERE id = $2', [item.quantity, item.food_id]);
      await client.query(
        `INSERT INTO order_items (order_id, food_id, food_name, food_price, quantity, note, prep_minutes_snapshot)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [order.rows[0].id, item.food_id, item.name, item.price, item.quantity, item.note, item.prep_minutes]
      );
    }
    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);
    await client.query('UPDATE queue_sessions SET status = $1, ordered_at = CURRENT_TIMESTAMP WHERE id = $2', ['ORDERED', req.student.sessionId]);
    await client.query('COMMIT');
    const detail = await orderDetails(order.rows[0].id);
    realtime.emitKitchen('order:created', detail);
    realtime.emitKitchen('queue:updated', await activeQueueSummary());
    res.status(201).json({ success: true, message: `Pesanan ${orderCode} masuk antrean.`, order: detail });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.get('/api/orders/active', studentAuth, asyncHandler(async (req, res) => {
  const order = await db.query('SELECT id FROM orders WHERE session_id = $1 ORDER BY id DESC LIMIT 1', [req.student.sessionId]);
  res.json({ success: true, order: order.rowCount ? await orderDetails(order.rows[0].id) : null });
}));

app.get('/api/orders/:id', studentAuth, asyncHandler(async (req, res) => {
  const order = await db.query('SELECT id FROM orders WHERE id = $1 AND session_id = $2', [req.params.id, req.student.sessionId]);
  if (!order.rowCount) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
  res.json({ success: true, order: await orderDetails(order.rows[0].id) });
}));

app.get('/api/orders/:id/status', studentAuth, asyncHandler(async (req, res) => {
  const order = await db.query('SELECT id, order_code, status, ready_at, picked_up_at FROM orders WHERE id = $1 AND session_id = $2', [req.params.id, req.student.sessionId]);
  if (!order.rowCount) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
  res.json({ success: true, order: order.rows[0] });
}));

app.post('/api/staff/login', staffLoginLimiter, asyncHandler(async (req, res) => {
  const staff = await db.query('SELECT * FROM staff_users WHERE username = $1 AND is_active = true', [String(req.body.username || '')]);
  if (!staff.rowCount || !(await bcrypt.compare(String(req.body.password || ''), staff.rows[0].password_hash))) {
    return res.status(401).json({ success: false, message: 'Username atau password salah.' });
  }
  const token = signStaff(staff.rows[0]);
  res.cookie('staff_token', token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    signed: false,
    maxAge: 10 * 60 * 60 * 1000,
  });
  res.json({ success: true, token, staff: { username: staff.rows[0].username, role: staff.rows[0].role } });
}));

app.post('/api/staff/logout', staffAuth, (req, res) => {
  res.clearCookie('staff_token');
  res.json({ success: true });
});

app.get('/api/staff/me', staffAuth, (req, res) => res.json({ success: true, staff: req.staff }));

app.get('/api/staff/orders', staffAuth, asyncHandler(async (req, res) => {
  const params = [];
  let where = 'WHERE 1=1';
  if (req.query.status) {
    params.push(req.query.status);
    where += ` AND status = $${params.length}`;
  }
  if (req.query.search) {
    params.push(`%${req.query.search}%`);
    where += ` AND order_code ILIKE $${params.length}`;
  }
  const result = await db.query(`SELECT id FROM orders ${where} ORDER BY created_at DESC LIMIT 100`, params);
  const orders = [];
  for (const row of result.rows) orders.push(await orderDetails(row.id));
  res.json({ success: true, orders });
}));

app.get('/api/staff/orders/:id', staffAuth, asyncHandler(async (req, res) => {
  const order = await orderDetails(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
  res.json({ success: true, order });
}));

async function restoreStock(orderId, client) {
  const items = await client.query('SELECT food_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
  for (const item of items.rows) {
    await client.query('UPDATE foods SET stock = stock + $1 WHERE id = $2', [item.quantity, item.food_id]);
  }
}

app.patch('/api/staff/orders/:id/status', staffAuth, asyncHandler(async (req, res) => {
  const nextStatus = String(req.body.status || '').toUpperCase();
  const reason = req.body.reason ? String(req.body.reason).slice(0, 300) : null;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    const order = result.rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
    }
    if (!LEGAL_TRANSITIONS[order.status]?.includes(nextStatus)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: `Transisi ${order.status} ke ${nextStatus} tidak valid.` });
    }
    if (nextStatus === 'REJECTED' && !reason) {
      await client.query('ROLLBACK');
      return res.status(422).json({ success: false, message: 'Alasan penolakan wajib diisi.' });
    }
    const timestampColumn = { ACCEPTED: 'accepted_at', PREPARING: 'preparing_at', READY: 'ready_at', PICKED_UP: 'picked_up_at', CANCELLED: 'cancelled_at' }[nextStatus];
    let sql = `UPDATE orders SET status = $1, rejection_reason = COALESCE($2, rejection_reason)`;
    const params = [nextStatus, reason, order.id];
    if (timestampColumn) sql += `, ${timestampColumn} = CURRENT_TIMESTAMP`;
    sql += ' WHERE id = $3 RETURNING *';
    await client.query(sql, params);
    if ((nextStatus === 'REJECTED' || nextStatus === 'CANCELLED') && !order.stock_restored) {
      await restoreStock(order.id, client);
      await client.query('UPDATE orders SET stock_restored = true WHERE id = $1', [order.id]);
    }
    if (nextStatus === 'PICKED_UP') {
      await client.query('UPDATE queue_sessions SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2', ['COMPLETED', order.session_id]);
    }
    await client.query('COMMIT');
    const detail = await orderDetails(order.id);
    realtime.emitKitchen('order:status-changed', detail);
    realtime.emitStudent(order.session_id, nextStatus === 'READY' ? 'order:ready' : 'order:status-changed', detail);
    realtime.emitKitchen('queue:updated', await activeQueueSummary());
    res.json({ success: true, order: detail });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.post('/api/staff/foods', staffAuth, asyncHandler(async (req, res) => {
  const body = req.body;
  const result = await db.query(
    `INSERT INTO foods (food_id, name, price, category, img, badge, tag, description, stock, prep_minutes, is_available)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [body.food_id, body.name, body.price, body.category, body.img || 'assets/hero_food.png', body.badge || null, body.tag || 'populer', body.description || null, body.stock || 0, body.prep_minutes || 5, body.is_available !== false]
  );
  realtime.emitKitchen('menu:updated', {});
  res.status(201).json({ success: true, food: safeFood(result.rows[0]) });
}));

app.patch('/api/staff/foods/:id', staffAuth, asyncHandler(async (req, res) => {
  const result = await db.query(
    `UPDATE foods SET
       name = COALESCE($1, name), price = COALESCE($2, price), category = COALESCE($3, category),
       img = COALESCE($4, img), stock = COALESCE($5, stock), prep_minutes = COALESCE($6, prep_minutes),
       is_available = COALESCE($7, is_available), description = COALESCE($8, description)
     WHERE id::text = $9 OR food_id = $9 RETURNING *`,
    [req.body.name, req.body.price, req.body.category, req.body.img, req.body.stock, req.body.prep_minutes, req.body.is_available, req.body.description, req.params.id]
  );
  if (!result.rowCount) return res.status(404).json({ success: false, message: 'Menu tidak ditemukan.' });
  realtime.emitKitchen('menu:updated', {});
  res.json({ success: true, food: safeFood(result.rows[0]) });
}));

app.delete('/api/staff/foods/:id', staffAuth, asyncHandler(async (req, res) => {
  await db.query('UPDATE foods SET is_available = false WHERE id::text = $1 OR food_id = $1', [req.params.id]);
  realtime.emitKitchen('menu:updated', {});
  res.json({ success: true });
}));

app.get('/api/staff/settings', staffAuth, asyncHandler(async (req, res) => {
  res.json({ success: true, settings: await getSettings() });
}));

app.patch('/api/staff/settings', staffAuth, asyncHandler(async (req, res) => {
  const result = await db.query(
    `UPDATE system_settings SET
       orders_open = COALESCE($1, orders_open),
       maximum_active_orders = COALESCE($2, maximum_active_orders),
       kitchen_parallelism = COALESCE($3, kitchen_parallelism),
       public_announcement = COALESCE($4, public_announcement)
     WHERE id = 1 RETURNING *`,
    [req.body.orders_open, req.body.maximum_active_orders, req.body.kitchen_parallelism, req.body.public_announcement]
  );
  realtime.emitKitchen('settings:updated', result.rows[0]);
  res.json({ success: true, settings: result.rows[0] });
}));

app.get('/dapur', (req, res) => res.sendFile(path.join(frontendPath, 'dapur', 'index.html')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan.' });
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: env.isProduction ? 'Terjadi kesalahan server.' : err.message,
  });
});

module.exports = app;
