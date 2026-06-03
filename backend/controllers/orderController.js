// controllers/orderController.js — Manajemen Pesanan
const db = require('../config/db');

// ── Helper: generate order code (format: A001 - Z999)
const generateOrderCode = async () => {
  const result = await db.query(
    "SELECT order_code FROM orders ORDER BY id DESC LIMIT 1"
  );
  const row = result.rows[0];

  if (!row) return 'A001';

  const code  = row.order_code;          // e.g. "A036"
  const letter = code.charAt(0);
  const num    = parseInt(code.slice(1));

  if (num < 999) {
    return letter + String(num + 1).padStart(3, '0');
  } else {
    const nextLetter = String.fromCharCode(letter.charCodeAt(0) + 1);
    return (nextLetter > 'Z' ? 'A' : nextLetter) + '001';
  }
};

// ── Helper: hitung diskon berdasarkan flags di body
const calculateDiscount = (subtotal, discountFlags) => {
  let discount = 0;
  if (discountFlags && discountFlags.freeClaimed) {
    discount += 10000;
  }
  if (discountFlags && discountFlags.codeApplied) {
    discount += Math.floor(subtotal * 0.20);
  }
  return Math.min(discount, subtotal);
};

// ============================================================
// POST /api/orders   [protected]
// Body: { payment_method, preorder_time, discount_flags: { freeClaimed, codeApplied } }
// ============================================================
exports.createOrder = async (req, res) => {
  const { payment_method = 'cash', preorder_time = null, discount_flags } = req.body;
  const userId = req.user.id;

  try {
    // 1. Ambil keranjang user
    const cartResult = await db.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
    const cart = cartResult.rows[0];
    if (!cart) {
      return res.status(400).json({ success: false, message: 'Keranjang tidak ditemukan.' });
    }

    const cartItemsResult = await db.query(
      `SELECT ci.id, ci.quantity, ci.note,
              f.id AS food_db_id, f.name AS food_name, f.price AS food_price, f.is_available
       FROM cart_items ci
       JOIN foods f ON ci.food_id = f.id
       WHERE ci.cart_id = $1`,
      [cart.id]
    );
    const cartItems = cartItemsResult.rows;

    if (cartItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Keranjang Anda kosong.' });
    }

    // 2. Cek ketersediaan semua item
    const unavailable = cartItems.filter(i => !i.is_available);
    if (unavailable.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Menu "${unavailable[0].food_name}" sedang habis. Hapus dari keranjang terlebih dahulu.`,
      });
    }

    // 3. Hitung harga
    const subtotal = cartItems.reduce((sum, i) => sum + (i.food_price * i.quantity), 0);
    const discount = calculateDiscount(subtotal, discount_flags);
    const grand_total = subtotal - discount;

    // 4. Generate kode order
    const order_code = await generateOrderCode();

    // 5. Insert order
    const orderResult = await db.query(
      `INSERT INTO orders (order_code, user_id, subtotal, discount, grand_total, payment_method, preorder_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'preparing') RETURNING id`,
      [order_code, userId, subtotal, discount, grand_total, payment_method, preorder_time]
    );
    const orderId = orderResult.rows[0].id;

    // 6. Insert order_items (snapshot harga saat order)
    for (const item of cartItems) {
      await db.query(
        `INSERT INTO order_items (order_id, food_id, food_name, food_price, quantity, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, item.food_db_id, item.food_name, item.food_price, item.quantity, item.note || null]
      );
    }

    // 7. Kosongkan keranjang setelah order berhasil
    await db.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);

    // 8. Update sold_count untuk setiap food yang dipesan
    for (const item of cartItems) {
      await db.query(
        'UPDATE foods SET sold_count = sold_count + $1 WHERE id = $2',
        [item.quantity, item.food_db_id]
      );
    }

    // 9. Ambil detail order lengkap untuk response
    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    const order = orderRes.rows[0];
    
    const orderItemsRes = await db.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [orderId]
    );
    const orderItems = orderItemsRes.rows;

    return res.status(201).json({
      success: true,
      message: `Pesanan ${order_code} berhasil dibuat!`,
      order: { ...order, items: orderItems },
    });
  } catch (err) {
    console.error('[orderController.createOrder]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};

// ============================================================
// GET /api/orders   [protected] — Semua riwayat pesanan
// ============================================================
exports.getOrders = async (req, res) => {
  try {
    const ordersResult = await db.query(
      `SELECT o.*, 
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', oi.id,
                    'food_id', oi.food_id,
                    'food_name', oi.food_name,
                    'food_price', oi.food_price,
                    'quantity', oi.quantity,
                    'note', oi.note
                  )
                ) FILTER (WHERE oi.id IS NOT NULL),
                '[]'::json
              ) AS items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    const orders = ordersResult.rows;

    // Parse JSON items (PG driver handles auto parsing, but we check to prevent format mismatch)
    const parsed = orders.map(o => ({
      ...o,
      items: Array.isArray(o.items) 
        ? o.items 
        : (typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || [])),
    }));

    return res.json({ success: true, orders: parsed });
  } catch (err) {
    console.error('[orderController.getOrders]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};

// ============================================================
// GET /api/orders/active   [protected] — Pesanan aktif (non-completed)
// ============================================================
exports.getActiveOrder = async (req, res) => {
  try {
    const orderRes = await db.query(
      `SELECT * FROM orders
       WHERE user_id = $1 AND status NOT IN ('completed', 'cancelled')
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );
    const order = orderRes.rows[0];

    if (!order) {
      return res.json({ success: true, order: null });
    }

    const itemsRes = await db.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [order.id]
    );
    const items = itemsRes.rows;

    return res.json({ success: true, order: { ...order, items } });
  } catch (err) {
    console.error('[orderController.getActiveOrder]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};

// ============================================================
// GET /api/orders/:id   [protected] — Detail pesanan
// ============================================================
exports.getOrderById = async (req, res) => {
  const orderId = parseInt(req.params.id);
  if (isNaN(orderId)) {
    return res.status(400).json({ success: false, message: 'ID Pesanan harus berupa angka.' });
  }

  try {
    const orderRes = await db.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, req.user.id]
    );
    const order = orderRes.rows[0];

    if (!order) {
      return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
    }

    const itemsRes = await db.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [order.id]
    );
    const items = itemsRes.rows;

    return res.json({ success: true, order: { ...order, items } });
  } catch (err) {
    console.error('[orderController.getOrderById]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};
