// controllers/cartController.js — Keranjang Belanja
const db = require('../config/db');

// ── Helper: ambil atau buat cart user
const getOrCreateCart = async (userId) => {
  const cartResult = await db.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
  let cart = cartResult.rows[0];
  if (!cart) {
    const result = await db.query('INSERT INTO carts (user_id) VALUES ($1) RETURNING id', [userId]);
    cart = { id: result.rows[0].id };
  }
  return cart;
};

// ── Helper: format item keranjang
const getCartWithItems = async (cartId) => {
  const itemsResult = await db.query(
    `SELECT ci.id, ci.quantity, ci.note,
            f.id AS food_db_id, f.food_id, f.name, f.price, f.img, f.is_available
     FROM cart_items ci
     JOIN foods f ON ci.food_id = f.id
     WHERE ci.cart_id = $1`,
    [cartId]
  );
  return itemsResult.rows;
};

// ============================================================
// GET /api/cart   [protected]
// ============================================================
exports.getCart = async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    const items = await getCartWithItems(cart.id);

    // Hitung subtotal
    const subtotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    return res.json({
      success: true,
      cart: {
        id: cart.id,
        items,
        subtotal,
        itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      },
    });
  } catch (err) {
    console.error('[cartController.getCart]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};

// ============================================================
// POST /api/cart/add   [protected]
// Body: { food_id: "nasi_jeruk", quantity: 1, note: "" }
// ============================================================
exports.addItem = async (req, res) => {
  const { food_id, quantity = 1, note = '' } = req.body;

  if (!food_id) {
    return res.status(400).json({ success: false, message: 'food_id wajib diisi.' });
  }

  try {
    // Validasi makanan ada dan tersedia
    const foodResult = await db.query(
      'SELECT id, name, is_available FROM foods WHERE food_id = $1',
      [food_id]
    );
    const food = foodResult.rows[0];

    if (!food) {
      return res.status(404).json({ success: false, message: 'Menu tidak ditemukan.' });
    }
    if (!food.is_available) {
      return res.status(400).json({ success: false, message: 'Maaf, menu ini sedang habis!' });
    }

    const cart = await getOrCreateCart(req.user.id);

    // Cek apakah item sudah ada di cart
    const existingResult = await db.query(
      'SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND food_id = $2',
      [cart.id, food.id]
    );
    const existing = existingResult.rows[0];

    if (existing) {
      // Update qty
      await db.query(
        'UPDATE cart_items SET quantity = quantity + $1 WHERE id = $2',
        [parseInt(quantity), existing.id]
      );
    } else {
      // Insert baru
      await db.query(
        'INSERT INTO cart_items (cart_id, food_id, quantity, note) VALUES ($1, $2, $3, $4)',
        [cart.id, food.id, parseInt(quantity), note]
      );
    }

    const items = await getCartWithItems(cart.id);
    const subtotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    return res.json({
      success: true,
      message: `${food.name} berhasil ditambahkan!`,
      cart: {
        id: cart.id,
        items,
        subtotal,
        itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      },
    });
  } catch (err) {
    console.error('[cartController.addItem]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};

// ============================================================
// PUT /api/cart/item/:itemId   [protected]
// Body: { quantity: 2, note: "tanpa bawang" }
// ============================================================
exports.updateItem = async (req, res) => {
  const { quantity, note } = req.body;
  const itemId = parseInt(req.params.itemId);

  try {
    const cart = await getOrCreateCart(req.user.id);

    const itemResult = await db.query(
      'SELECT id FROM cart_items WHERE id = $1 AND cart_id = $2',
      [itemId, cart.id]
    );
    const item = itemResult.rows[0];

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item keranjang tidak ditemukan.' });
    }

    const newQty = parseInt(quantity);

    if (newQty <= 0) {
      // Hapus item jika qty <= 0
      await db.query('DELETE FROM cart_items WHERE id = $1', [itemId]);
    } else {
      const updates = [];
      const params = [];
      let paramIdx = 1;

      if (quantity !== undefined) {
        updates.push(`quantity = $${paramIdx++}`);
        params.push(newQty);
      }
      if (note !== undefined) {
        updates.push(`note = $${paramIdx++}`);
        params.push(note);
      }

      if (updates.length > 0) {
        params.push(itemId);
        await db.query(
          `UPDATE cart_items SET ${updates.join(', ')} WHERE id = $${paramIdx++}`,
          params
        );
      }
    }

    const items = await getCartWithItems(cart.id);
    const subtotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    return res.json({
      success: true,
      message: 'Keranjang diperbarui.',
      cart: {
        id: cart.id,
        items,
        subtotal,
        itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      },
    });
  } catch (err) {
    console.error('[cartController.updateItem]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};

// ============================================================
// DELETE /api/cart/item/:itemId   [protected]
// ============================================================
exports.removeItem = async (req, res) => {
  const itemId = parseInt(req.params.itemId);

  try {
    const cart = await getOrCreateCart(req.user.id);

    const itemResult = await db.query(
      'SELECT id FROM cart_items WHERE id = $1 AND cart_id = $2',
      [itemId, cart.id]
    );
    const item = itemResult.rows[0];

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item tidak ditemukan.' });
    }

    await db.query('DELETE FROM cart_items WHERE id = $1', [itemId]);

    const items = await getCartWithItems(cart.id);
    const subtotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    return res.json({
      success: true,
      message: 'Item dihapus dari keranjang.',
      cart: {
        id: cart.id,
        items,
        subtotal,
        itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      },
    });
  } catch (err) {
    console.error('[cartController.removeItem]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};

// ============================================================
// DELETE /api/cart   [protected] — Kosongkan keranjang
// ============================================================
exports.clearCart = async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    await db.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);

    return res.json({ success: true, message: 'Keranjang berhasil dikosongkan.' });
  } catch (err) {
    console.error('[cartController.clearCart]', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
};
